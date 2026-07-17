import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ContractValidationError,
  inspectPublicationContract,
  parseKnowledgePublication,
} from "../src/validation";

interface GoldenCase {
  readonly file: string;
  readonly valid: boolean;
}

const fixtures = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data/fixtures/contracts/0.4",
);

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

describe("canonical publication contract", () => {
  it("agrees with every language-neutral golden case", async () => {
    const cases = (await readJson(
      resolve(fixtures, "cases.json"),
    )) as GoldenCase[];
    for (const item of cases) {
      const value = await readJson(resolve(fixtures, item.file));
      const issues = inspectPublicationContract(value);
      if (item.valid) {
        expect(issues, `${item.file} should be valid`).toHaveLength(0);
      } else {
        expect(issues, `${item.file} should be invalid`).not.toHaveLength(0);
      }
    }
  });

  it("parses valid JSON and exposes deterministic validation errors", async () => {
    const valid = await readJson(
      resolve(fixtures, "valid/minimal-publication.json"),
    );
    expect(parseKnowledgePublication(valid).manifest.contractVersion).toBe(
      "0.4.0",
    );
    const invalid = await readJson(
      resolve(fixtures, "invalid/missing-root-collection.json"),
    );
    expect(() => parseKnowledgePublication(invalid)).toThrow(
      ContractValidationError,
    );
    try {
      parseKnowledgePublication(invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(ContractValidationError);
      expect((error as ContractValidationError).issues[0]?.path).toBe("$");
    }
  });
});
