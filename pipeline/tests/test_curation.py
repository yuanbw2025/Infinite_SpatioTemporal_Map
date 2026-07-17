"""Candidate identity and append-only review transition checks."""

from __future__ import annotations

import unittest

from infinite_spacetime_pipeline.curation import (
    CurationError,
    apply_review_decisions,
    create_candidate_batch,
    promote_reviewed_candidates,
)


class CurationTest(unittest.TestCase):
    def test_candidate_ids_are_stable_and_reviews_do_not_mutate_input(self) -> None:
        proposals = [
            {
                "kind": "entity",
                "payload": {
                    "type": "person",
                    "preferredName": "张三",
                    "aliases": [],
                },
                "evidence": [{"passageId": "passage-a", "start": 0, "end": 2}],
            }
        ]
        arguments = {
            "publication_id": "publication-a",
            "base_content_checksum": "sha256:" + ("0" * 64),
            "generator_id": "test-generator",
            "generated_at": "1970-01-01T00:00:00Z",
        }
        first = create_candidate_batch(proposals, **arguments)
        second = create_candidate_batch(proposals, **arguments)
        self.assertEqual(first["candidates"][0]["id"], second["candidates"][0]["id"])

        candidate_id = first["candidates"][0]["id"]
        reviewed = apply_review_decisions(
            first,
            [
                {
                    "candidateId": candidate_id,
                    "status": "verified",
                    "reviewer": "tester",
                    "decidedAt": "1970-01-01T00:00:00Z",
                }
            ],
        )
        self.assertEqual(first["candidates"][0]["reviewHistory"], [])
        self.assertEqual(reviewed["candidates"][0]["status"], "verified")

    def test_pending_candidates_cannot_be_promoted(self) -> None:
        batch = create_candidate_batch(
            [
                {
                    "kind": "entity",
                    "payload": {"preferredName": "待审"},
                    "evidence": [{"passageId": "passage-a", "start": 0, "end": 1}],
                }
            ],
            publication_id="publication-a",
            base_content_checksum="sha256:" + ("0" * 64),
            generator_id="test",
        )
        with self.assertRaisesRegex(CurationError, "pending"):
            promote_reviewed_candidates(batch)


if __name__ == "__main__":
    unittest.main()
