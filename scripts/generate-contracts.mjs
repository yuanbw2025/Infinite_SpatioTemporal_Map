import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";
import prettier from "prettier";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(
  root,
  "packages/contracts/schemas/publication.schema.json",
);
const publicationOutputPath = path.join(
  root,
  "packages/contracts/src/generated/publication.ts",
);
const versionOutputPath = path.join(
  root,
  "packages/contracts/src/generated/version.ts",
);
const checkOnly = process.argv.includes("--check");

const generated = await compileFromFile(schemaPath, {
  additionalProperties: false,
  cwd: path.dirname(schemaPath),
  enableConstEnums: false,
  format: false,
  unknownAny: true,
  unreachableDefinitions: true,
});
const formatted = await prettier.format(generated, {
  filepath: publicationOutputPath,
  parser: "typescript",
});
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const contractVersion =
  schema.definitions?.PublicationManifest?.properties?.contractVersion?.const;
if (typeof contractVersion !== "string") {
  throw new Error("Canonical Schema has no string contractVersion const.");
}
const versionSource = await prettier.format(
  `/** Generated from publication.schema.json. Do not edit. */\nexport const CONTRACT_VERSION = ${JSON.stringify(contractVersion)} as const;\n`,
  { filepath: versionOutputPath, parser: "typescript" },
);

if (checkOnly) {
  let currentPublication = "";
  let currentVersion = "";
  try {
    [currentPublication, currentVersion] = await Promise.all([
      readFile(publicationOutputPath, "utf8"),
      readFile(versionOutputPath, "utf8"),
    ]);
  } catch {
    // A missing generated artifact is reported as drift below.
  }
  if (currentPublication !== formatted || currentVersion !== versionSource) {
    console.error(
      "Generated contract DTOs are stale. Run `pnpm contracts:generate`.",
    );
    process.exitCode = 1;
  } else {
    console.log("Generated contract DTOs match the canonical JSON Schema.");
  }
} else {
  await Promise.all([
    writeFile(publicationOutputPath, formatted, "utf8"),
    writeFile(versionOutputPath, versionSource, "utf8"),
  ]);
  console.log(
    `Generated ${path.relative(root, publicationOutputPath)} and contract version.`,
  );
}
