import type { CandidateReviewDecisionBundle } from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import {
  decisionBundleMatchesScope,
  isDecisionBundle,
  mergeDecisionBundles,
} from "./decision-bundle";

function bundle(
  bundleId: string,
  status: "verified" | "disputed" = "verified",
  reviewer = bundleId,
): CandidateReviewDecisionBundle {
  return {
    version: 1,
    bundleId,
    workspace: "candidate_review",
    publicationId: "publication-a",
    baseContentChecksum: `sha256:${"1".repeat(64)}`,
    batchKey: "generator:time",
    createdAt: `2026-07-20T00:00:0${bundleId.length}Z`,
    createdBy: reviewer,
    decisions: [
      {
        candidateId: "candidate-a",
        status,
        reviewer,
        decidedAt: `2026-07-20T00:00:0${bundleId.length}Z`,
      },
    ],
  };
}

describe("decision collaboration bundles", () => {
  it("merges equivalent outcomes deterministically and preserves provenance", () => {
    const result = mergeDecisionBundles([
      bundle("review-a", "verified", "甲"),
      bundle("review-b", "verified", "乙"),
    ]);
    expect(result.bundle).toMatchObject({
      workspace: "candidate_review",
      sourceBundleIds: ["review-a", "review-b"],
      decisions: [{ candidateId: "candidate-a", reviewer: "乙" }],
    });
    expect(result.report).toMatchObject({
      mergedDecisionCount: 1,
      equivalentDecisionCount: 1,
      conflicts: [],
    });
    const nested = mergeDecisionBundles([
      result.bundle!,
      bundle("review-c", "verified", "丙"),
    ]);
    expect(nested.bundle?.sourceBundleIds).toEqual([
      "merged:review-a+review-b",
      "review-a",
      "review-b",
      "review-c",
    ]);
  });

  it("reports substantive conflicts without producing an applicable bundle", () => {
    const result = mergeDecisionBundles([
      bundle("review-a", "verified"),
      bundle("review-b", "disputed"),
    ]);
    expect(result.bundle).toBeUndefined();
    expect(result.report.conflicts).toEqual([
      expect.objectContaining({
        decisionId: "candidate-a",
        variants: expect.arrayContaining([
          expect.objectContaining({ sourceBundleId: "review-a" }),
          expect.objectContaining({ sourceBundleId: "review-b" }),
        ]),
      }),
    ]);
    const firstNested = bundle("review-c");
    const secondNested = bundle("review-d");
    const nestedAuditField = {
      ...firstNested,
      decisions: [
        {
          ...firstNested.decisions[0]!,
          correctedPayload: { reviewer: "甲" },
        },
      ],
    };
    const nestedDifferent = {
      ...secondNested,
      decisions: [
        {
          ...secondNested.decisions[0]!,
          correctedPayload: { reviewer: "乙" },
        },
      ],
    };
    expect(
      mergeDecisionBundles([nestedAuditField, nestedDifferent]).bundle,
    ).toBeUndefined();
  });

  it("validates envelopes and rejects mixed or duplicated scopes", () => {
    expect(isDecisionBundle(bundle("review-a"))).toBe(true);
    expect(isDecisionBundle(null)).toBe(false);
    expect(isDecisionBundle({ ...bundle("review-a"), decisions: [{}] })).toBe(
      false,
    );
    expect(
      decisionBundleMatchesScope(bundle("review-a"), {
        workspace: "candidate_review",
        publicationId: "publication-a",
        baseContentChecksum: `sha256:${"1".repeat(64)}`,
        batchKey: "generator:time",
      }),
    ).toBe(true);
    expect(() => mergeDecisionBundles([])).toThrow("至少");
    expect(() =>
      mergeDecisionBundles([
        bundle("review-a"),
        { ...bundle("review-b"), publicationId: "other" },
      ]),
    ).toThrow("不属于");
    expect(() =>
      mergeDecisionBundles([bundle("same"), bundle("same")]),
    ).toThrow("重复 bundleId");
    expect(() =>
      mergeDecisionBundles([
        {
          ...bundle("review-a"),
          decisions: [
            bundle("review-a").decisions[0]!,
            bundle("review-a").decisions[0]!,
          ],
        },
      ]),
    ).toThrow("重复目标");
  });
});
