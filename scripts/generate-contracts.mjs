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
const predicateVocabularyPath = path.join(
  root,
  "packages/contracts/vocabularies/predicates.json",
);
const predicateOutputPath = path.join(
  root,
  "packages/contracts/src/generated/predicates.ts",
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
const predicateVocabulary = JSON.parse(
  await readFile(predicateVocabularyPath, "utf8"),
);
const predicateDefinitions = predicateVocabulary.definitions;
if (
  typeof predicateVocabulary.version !== "string" ||
  !Array.isArray(predicateDefinitions) ||
  predicateDefinitions.some(
    (definition) =>
      !definition ||
      typeof definition !== "object" ||
      typeof definition.id !== "string",
  )
) {
  throw new Error("Predicate vocabulary is malformed.");
}
const predicateIds = predicateDefinitions.map((definition) => definition.id);
if (new Set(predicateIds).size !== predicateIds.length) {
  throw new Error("Predicate vocabulary contains duplicate IDs.");
}
const schemaPredicateIds = schema.definitions?.PredicateId?.enum;
if (JSON.stringify(schemaPredicateIds) !== JSON.stringify(predicateIds)) {
  throw new Error(
    "Schema PredicateId enum must match vocabularies/predicates.json.",
  );
}
const contractVersion =
  schema.definitions?.PublicationManifest?.properties?.contractVersion?.const;
if (typeof contractVersion !== "string") {
  throw new Error("Canonical Schema has no string contractVersion const.");
}
const versionSource = await prettier.format(
  `/** Generated from publication.schema.json. Do not edit. */\nexport const CONTRACT_VERSION = ${JSON.stringify(contractVersion)} as const;\n`,
  { filepath: versionOutputPath, parser: "typescript" },
);
const predicateSource = await prettier.format(
  `/** Generated from vocabularies/predicates.json. Do not edit. */
export const PREDICATE_VOCABULARY_VERSION = ${JSON.stringify(predicateVocabulary.version)} as const;
export const PREDICATE_DEFINITIONS = ${JSON.stringify(predicateDefinitions)} as const;
`,
  { filepath: predicateOutputPath, parser: "typescript" },
);

if (checkOnly) {
  let currentPublication = "";
  let currentVersion = "";
  let currentPredicates = "";
  try {
    [currentPublication, currentVersion, currentPredicates] = await Promise.all(
      [
        readFile(publicationOutputPath, "utf8"),
        readFile(versionOutputPath, "utf8"),
        readFile(predicateOutputPath, "utf8"),
      ],
    );
  } catch {
    // A missing generated artifact is reported as drift below.
  }
  if (
    currentPublication !== formatted ||
    currentVersion !== versionSource ||
    currentPredicates !== predicateSource
  ) {
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
    writeFile(predicateOutputPath, predicateSource, "utf8"),
  ]);
  console.log(
    `Generated ${path.relative(root, publicationOutputPath)} and contract version.`,
  );
}
