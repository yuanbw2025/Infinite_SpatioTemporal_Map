import { describe, expect, it } from "vitest";
import type { PassageAlignmentBatch } from "@infinite-spacetime/contracts";
import {
  decisionsBelongToBatch,
  isPassageAlignmentBatch,
  passageAlignmentStorageKey,
} from "./passage-alignment-batch";

const batch: PassageAlignmentBatch = {
  version: 1,
  publicationId: "publication-a",
  baseContentChecksum: `sha256:${"0".repeat(64)}`,
  workId: "work-a",
  leftEditionId: "edition-a",
  rightEditionId: "edition-b",
  generatorId: "test",
  generatedAt: "1970-01-01T00:00:00Z",
  leftPassages: [],
  rightPassages: [],
  items: [],
};

describe("passage alignment review boundary", () => {
  it("binds local progress to the exact publication checksum and edition pair", () => {
    expect(isPassageAlignmentBatch(batch)).toBe(true);
    expect(passageAlignmentStorageKey(batch)).toContain(
      batch.baseContentChecksum,
    );
  });

  it("rejects decisions from another batch", () => {
    expect(
      decisionsBelongToBatch(batch, [
        {
          suggestionId: "unknown",
          resolution: "reject",
          reviewStatus: "reviewed",
          reviewer: "tester",
          decidedAt: "1970-01-01T00:00:00Z",
        },
      ]),
    ).toBe(false);
  });
});
