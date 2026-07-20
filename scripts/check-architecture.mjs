import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "config/architecture-debt-baseline.json");
const sourceRoots = ["apps", "packages", "pipeline/src"];
const ignoredDirectories = new Set([
  ".git",
  "__pycache__",
  "dist",
  "node_modules",
]);
const codeExtensions = new Set([".css", ".py", ".ts", ".tsx", ".vue"]);
const importExtensions = new Set([".ts", ".tsx", ".vue"]);
const failures = [];

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else files.push(target);
  }
  return files;
}

function fail(file, rule, message) {
  failures.push(`${relative(file)} [${rule}] ${message}`);
}

function packageFromImport(specifier) {
  const match = specifier.match(/^@infinite-spacetime\/([^/]+)(\/.*)?$/);
  return match ? { name: match[1], deepPath: match[2] } : undefined;
}

function ownerFor(file) {
  const name = relative(file);
  const packageMatch = name.match(/^packages\/([^/]+)\//);
  if (packageMatch) return packageMatch[1];
  if (name.startsWith("apps/web/")) return "web";
  if (name.startsWith("apps/curation/")) return "curation";
  return undefined;
}

const allowedWorkspaceDependencies = {
  contracts: new Set(),
  domain: new Set(["contracts"]),
  ports: new Set(["contracts"]),
  application: new Set(["contracts", "domain", "ports"]),
  adapters: new Set(["contracts", "domain", "ports"]),
  web: new Set(["adapters", "application", "contracts"]),
  curation: new Set(["application", "contracts"]),
};

function extractImports(source) {
  const imports = [];
  const staticPattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^;]*?\sfrom\s+)?["']([^"']+)["']/gs;
  const dynamicPattern = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const pattern of [staticPattern, dynamicPattern]) {
    for (const match of source.matchAll(pattern)) imports.push(match[1]);
  }
  return imports;
}

function checkWorkspaceImport(file, specifier) {
  const imported = packageFromImport(specifier);
  if (!imported) return;
  const owner = ownerFor(file);
  if (!owner) return;

  if (imported.deepPath) {
    fail(
      file,
      "workspace-public-api",
      `deep import is forbidden: ${specifier}`,
    );
  }

  const allowed = allowedWorkspaceDependencies[owner];
  if (!allowed?.has(imported.name)) {
    fail(
      file,
      "dependency-direction",
      `${owner} may not depend on @infinite-spacetime/${imported.name}`,
    );
  }

  if (
    imported.name === "adapters" &&
    relative(file) !== "apps/web/src/platform/application.ts" &&
    relative(file) !== "apps/curation/src/platform/application.ts"
  ) {
    fail(
      file,
      "composition-root",
      "adapters may only be imported by a platform composition root",
    );
  }
}

function checkFeatureIsolation(file, specifier) {
  if (!specifier.startsWith(".")) return;
  const sourceFeature = relative(file).match(
    /^apps\/web\/src\/features\/([^/]+)\//,
  )?.[1];
  if (!sourceFeature) return;
  const resolved = relative(path.resolve(path.dirname(file), specifier));
  const targetFeature = resolved.match(
    /^apps\/web\/src\/features\/([^/]+)\//,
  )?.[1];
  if (targetFeature && targetFeature !== sourceFeature) {
    fail(
      file,
      "feature-isolation",
      `${sourceFeature} imports internal code from ${targetFeature}`,
    );
  }
}

function checkDirectDataAccess(file, source, imports) {
  const name = relative(file);
  if (!name.startsWith("apps/")) return;
  const isCompositionRoot =
    /apps\/(?:web|curation)\/src\/platform\/application\.ts$/.test(name);
  if (!isCompositionRoot && /\bfetch\s*\(/.test(source)) {
    fail(
      file,
      "data-access",
      "fetch belongs in an adapter or platform composition root",
    );
  }
  for (const specifier of imports) {
    if (/public\/data|publication\.json/.test(specifier)) {
      fail(
        file,
        "data-access",
        `direct publication import is forbidden: ${specifier}`,
      );
    }
  }
}

function checkFileName(file) {
  const extension = path.extname(file);
  const base = path.basename(file);
  if (extension === ".vue" && !/^[A-Z][A-Za-z0-9]*\.vue$/.test(base)) {
    fail(file, "file-name", "Vue components must use PascalCase.vue");
  }
  if (extension === ".py" && !/^_*[a-z][a-z0-9_]*\.py$/.test(base)) {
    fail(file, "file-name", "Python modules must use snake_case.py");
  }
  if (extension === ".ts" || extension === ".tsx") {
    const exceptions = new Set([
      "env.d.ts",
      "index.ts",
      "main.ts",
      "router.ts",
      "vite.config.ts",
      "vitest.config.ts",
    ]);
    const stem = base
      .replace(/\.(?:test|spec)\.(?:ts|tsx)$/, "")
      .replace(/\.(?:ts|tsx)$/, "");
    if (!exceptions.has(base) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stem)) {
      fail(file, "file-name", "TypeScript modules must use kebab-case.ts");
    }
  }
}

function visitSchema(node, file, pointer = "#") {
  if (!node || typeof node !== "object") return;
  if (node.properties && typeof node.properties === "object") {
    for (const field of Object.keys(node.properties)) {
      if (!/^[a-z][A-Za-z0-9]*$/.test(field)) {
        fail(
          file,
          "contract-field-name",
          `${pointer}/properties/${field} is not camelCase`,
        );
      }
      if (/(?:ID|URL|URI)$/.test(field)) {
        fail(
          file,
          "contract-field-suffix",
          `${field} must use Id, Url, or Uri casing`,
        );
      }
    }
  }
  if (Array.isArray(node.enum)) {
    const isPredicateId = pointer.endsWith("/definitions/PredicateId");
    for (const value of node.enum) {
      const valid =
        typeof value !== "string" ||
        (isPredicateId
          ? /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)+$/.test(value)
          : /^[a-z][a-z0-9_]*$/.test(value));
      if (!valid) {
        fail(
          file,
          "contract-enum",
          `${pointer} enum value ${JSON.stringify(value)} has invalid canonical casing`,
        );
      }
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "object")
      visitSchema(value, file, `${pointer}/${key}`);
  }
}

async function checkSchemas() {
  const schemaRoot = path.join(root, "packages/contracts/schemas");
  for (const file of await walk(schemaRoot)) {
    if (path.extname(file) !== ".json") continue;
    try {
      visitSchema(JSON.parse(await readFile(file, "utf8")), file);
    } catch (error) {
      fail(file, "schema-json", `cannot parse JSON: ${error.message}`);
    }
  }
}

async function checkPackageManifests() {
  const workspaceRoots = [path.join(root, "apps"), path.join(root, "packages")];
  for (const workspaceRoot of workspaceRoots) {
    for (const entry of await readdir(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = path.join(workspaceRoot, entry.name, "package.json");
      let manifest;
      try {
        manifest = JSON.parse(await readFile(file, "utf8"));
      } catch {
        continue;
      }
      const owner = ownerFor(file);
      const dependencies = {
        ...(manifest.dependencies ?? {}),
        ...(manifest.devDependencies ?? {}),
        ...(manifest.peerDependencies ?? {}),
      };
      for (const dependency of Object.keys(dependencies)) {
        const imported = packageFromImport(dependency);
        if (!imported) continue;
        if (!allowedWorkspaceDependencies[owner]?.has(imported.name)) {
          fail(
            file,
            "manifest-dependency",
            `${owner} may not declare @infinite-spacetime/${imported.name}`,
          );
        }
      }
    }
  }
}

async function checkSizes(files, baseline) {
  const debts = baseline.files ?? {};
  const seenDebts = new Set();
  for (const file of files) {
    const extension = path.extname(file);
    if (!codeExtensions.has(extension)) continue;
    const name = relative(file);
    if (/\/src\/generated\//.test(name)) continue;
    const lineCount = (await readFile(file, "utf8")).split(/\r?\n/).length - 1;
    const defaultLimit =
      extension === ".css" ? baseline.limits.stylesheet : baseline.limits.code;
    const debt = debts[name];
    if (debt) {
      seenDebts.add(name);
      if (lineCount > debt.maxLines) {
        fail(
          file,
          "debt-growth",
          `${lineCount} lines exceeds locked baseline ${debt.maxLines}`,
        );
      }
      if (lineCount <= defaultLimit) {
        fail(
          file,
          "stale-debt",
          `now ${lineCount} lines; remove its obsolete debt entry`,
        );
      }
    } else if (lineCount > defaultLimit) {
      fail(
        file,
        "file-size",
        `${lineCount} lines exceeds hard limit ${defaultLimit}`,
      );
    }
  }
  for (const name of Object.keys(debts)) {
    if (!seenDebts.has(name)) {
      failures.push(
        `${name} [stale-debt] baseline file does not exist or is outside source roots`,
      );
    }
  }
}

async function main() {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  if (baseline.decision !== "ADR-0012") {
    failures.push(
      "config/architecture-debt-baseline.json [baseline] decision must be ADR-0012",
    );
  }

  const files = [];
  for (const sourceRoot of sourceRoots) {
    const directory = path.join(root, sourceRoot);
    try {
      if ((await stat(directory)).isDirectory())
        files.push(...(await walk(directory)));
    } catch {
      // Target workspaces may not exist until their migration step starts.
    }
  }

  for (const file of files) {
    checkFileName(file);
    if (!importExtensions.has(path.extname(file))) continue;
    const source = await readFile(file, "utf8");
    const imports = extractImports(source);
    for (const specifier of imports) {
      checkWorkspaceImport(file, specifier);
      checkFeatureIsolation(file, specifier);
    }
    checkDirectDataAccess(file, source, imports);
  }

  await checkSchemas();
  await checkPackageManifests();
  await checkSizes(files, baseline);

  if (failures.length > 0) {
    console.error(
      `Architecture check failed with ${failures.length} violation(s):`,
    );
    for (const violation of failures.sort()) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Architecture check passed (${files.length} files, ${Object.keys(baseline.files).length} locked debt entries).`,
  );
}

await main();
