import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const requiredFiles = [
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/project-governance.md",
  "docs/quality-standard.md",
  "docs/adr/README.md",
];
const forbiddenLicenses = [
  /\bAGPL\b/i,
  /\bGPL(?:-\d|$)/i,
  /\bSSPL\b/i,
  /Commons-Clause/i,
  /UNLICENSED/i,
  /UNKNOWN/i,
];
const secretPatterns = [
  [
    "private key",
    new RegExp("-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
  ],
  ["AWS access key", new RegExp("\\bAKIA[0-9A-Z]{16}\\b")],
  ["GitHub token", new RegExp("\\bgh[pousr]_[A-Za-z0-9]{30,}\\b")],
  ["OpenAI-style key", new RegExp("\\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\\b")],
];

for (const name of requiredFiles) {
  try {
    await stat(path.join(root, name));
  } catch {
    failures.push(`missing governance file: ${name}`);
  }
}

const repositoryFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);

for (const name of repositoryFiles) {
  if (name === "scripts/check-repository-hygiene.mjs") continue;
  const file = path.join(root, name);
  let metadata;
  try {
    metadata = await stat(file);
  } catch {
    continue;
  }
  if (!metadata.isFile() || metadata.size > 2_000_000) continue;
  const buffer = await readFile(file);
  if (buffer.includes(0)) continue;
  const source = buffer.toString("utf8");
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(source)) failures.push(`${name}: possible ${label}`);
  }
}

let licenses;
try {
  licenses = JSON.parse(
    execFileSync("pnpm", ["licenses", "list", "--json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
} catch (error) {
  failures.push(`cannot inspect dependency licenses: ${error.message}`);
  licenses = {};
}
for (const license of Object.keys(licenses)) {
  if (forbiddenLicenses.some((pattern) => pattern.test(license))) {
    failures.push(`dependency license requires explicit review: ${license}`);
  }
}

if (failures.length > 0) {
  console.error(`Repository hygiene failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Repository hygiene passed (${repositoryFiles.length} files, ${Object.keys(licenses).length} license groups).`,
  );
}
