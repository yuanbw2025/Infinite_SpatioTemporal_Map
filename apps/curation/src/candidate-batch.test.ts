import type { CandidateBatch } from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import { candidateStorageKey, isCandidateBatch } from "./candidate-batch";

const batch = {
  version: 1,
  publicationId: "fictional-test",
  baseContentChecksum: `sha256:${"0".repeat(64)}`,
  generatorId: "test",
  generatedAt: "1970-01-01T00:00:00Z",
  candidates: [],
} as CandidateBatch;

describe("candidate batch boundary", () => {
  it("accepts the stable transport shape and derives a versioned local key", () => {
    expect(isCandidateBatch(batch)).toBe(true);
    expect(candidateStorageKey(batch)).toContain("fictional-test");
    expect(candidateStorageKey(batch)).toContain(batch.baseContentChecksum);
  });

  it("rejects incomplete and malformed batches", () => {
    expect(isCandidateBatch(null)).toBe(false);
    expect(isCandidateBatch({ ...batch, version: 2 })).toBe(false);
    expect(isCandidateBatch({ ...batch, candidates: {} })).toBe(false);
  });
});
