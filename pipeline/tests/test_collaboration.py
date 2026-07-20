"""Decision bundle merge must be deterministic and conflict-safe."""

from __future__ import annotations

import unittest

from infinite_spacetime_pipeline.collaboration import (
    CollaborationError,
    decisions_from,
    merge_decision_bundles,
)


def _bundle(identifier: str, status: str = "verified", reviewer: str = "甲") -> dict:
    return {
        "version": 1,
        "bundleId": identifier,
        "workspace": "candidate_review",
        "publicationId": "publication-a",
        "baseContentChecksum": "sha256:" + ("1" * 64),
        "batchKey": "generator:time",
        "createdAt": f"2026-07-20T00:00:0{len(identifier)}Z",
        "createdBy": reviewer,
        "decisions": [
            {
                "candidateId": "candidate-a",
                "status": status,
                "reviewer": reviewer,
                "decidedAt": f"2026-07-20T00:00:0{len(identifier)}Z",
            }
        ],
    }


class CollaborationTest(unittest.TestCase):
    def test_equivalent_decisions_merge_with_contributor_audit(self) -> None:
        merged, report = merge_decision_bundles(
            [_bundle("review-a", reviewer="甲"), _bundle("review-b", reviewer="乙")]
        )
        self.assertIsNotNone(merged)
        self.assertEqual(merged["decisions"][0]["reviewer"], "乙")
        self.assertEqual(report["equivalentDecisionCount"], 1)
        self.assertEqual(
            len(report["contributors"]["candidate-a"]),
            2,
        )
        nested, _ = merge_decision_bundles(
            [merged, _bundle("review-c", reviewer="丙")]
        )
        self.assertEqual(
            nested["sourceBundleIds"],
            sorted(
                [
                    merged["bundleId"],
                    "review-a",
                    "review-b",
                    "review-c",
                ]
            ),
        )

    def test_substantive_conflicts_never_produce_merged_decisions(self) -> None:
        merged, report = merge_decision_bundles(
            [_bundle("review-a"), _bundle("review-b", "disputed")]
        )
        self.assertIsNone(merged)
        self.assertEqual(report["conflicts"][0]["decisionId"], "candidate-a")

    def test_empty_mixed_and_duplicate_bundles_are_rejected(self) -> None:
        with self.assertRaisesRegex(CollaborationError, "at least"):
            merge_decision_bundles([])
        other = _bundle("review-b")
        other["publicationId"] = "other"
        with self.assertRaisesRegex(CollaborationError, "do not share"):
            merge_decision_bundles([_bundle("review-a"), other])
        with self.assertRaisesRegex(CollaborationError, "duplicate bundleId"):
            merge_decision_bundles([_bundle("same"), _bundle("same")])
        repeated = _bundle("review-a")
        repeated["decisions"].append(repeated["decisions"][0])
        with self.assertRaisesRegex(CollaborationError, "repeats"):
            merge_decision_bundles([repeated])

    def test_decision_reader_accepts_bundles_and_legacy_arrays(self) -> None:
        bundle = _bundle("review-a")
        self.assertEqual(
            decisions_from(bundle, "candidate_review"),
            bundle["decisions"],
        )
        self.assertEqual(
            decisions_from(bundle["decisions"], "candidate_review"),
            bundle["decisions"],
        )
        with self.assertRaisesRegex(CollaborationError, "expected entity_alignment"):
            decisions_from(bundle, "entity_alignment")
        with self.assertRaisesRegex(CollaborationError, "only objects"):
            decisions_from(["invalid"], "candidate_review")


if __name__ == "__main__":
    unittest.main()
