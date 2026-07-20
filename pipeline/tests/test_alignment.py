"""Alignment must bind to an exact publication and preserve lineage."""

from __future__ import annotations

import unittest

from infinite_spacetime_pipeline.alignment import (
    AlignmentError,
    resolve_alignments,
    suggest_alignments,
)
from infinite_spacetime_pipeline.publication_identity import with_content_checksum


def _publication() -> dict:
    return with_content_checksum(
        {
            "manifest": {
                "contractVersion": "0.5.0",
                "publicationId": "alignment-test",
                "datasetVersion": "0.0.0",
                "title": "对齐测试",
                "generatedAt": "1970-01-01T00:00:00Z",
                "contentChecksum": "sha256:" + ("0" * 64),
                "sourceDescription": "测试",
            },
            "sources": [],
            "works": [],
            "editions": [],
            "volumes": [],
            "facsimilePages": [],
            "passages": [],
            "entities": [
                {
                    "id": "entity-existing",
                    "type": "person",
                    "preferredName": "张三",
                    "aliases": [],
                    "reviewStatus": "verified",
                }
            ],
            "mentions": [],
            "assertions": [],
            "places": [],
            "geometries": [],
            "occurrences": [],
        }
    )


def _batch(checksum: str) -> dict:
    return {
        "version": 1,
        "publicationId": "alignment-test",
        "baseContentChecksum": checksum,
        "generatorId": "test",
        "generatedAt": "1970-01-01T00:00:00Z",
        "candidates": [
            {
                "id": "candidate-entity-new",
                "kind": "entity",
                "payload": {
                    "id": "entity-new",
                    "type": "person",
                    "preferredName": "張三",
                    "aliases": ["张三"],
                    "reviewStatus": "reviewed",
                },
                "evidence": [{"passageId": "passage-a", "start": 0, "end": 2}],
                "status": "reviewed",
                "reviewHistory": [],
            }
        ],
    }


class AlignmentTest(unittest.TestCase):
    def test_resolution_rebases_remaining_candidates_to_new_checksum(self) -> None:
        publication = _publication()
        batch = _batch(publication["manifest"]["contentChecksum"])
        alignment = suggest_alignments(batch, publication)
        item = alignment["items"][0]
        next_batch, next_publication = resolve_alignments(
            batch,
            publication,
            alignment,
            [
                {
                    "alignmentId": item["id"],
                    "resolution": "merge_existing",
                    "targetId": "entity-existing",
                    "reviewer": "tester",
                    "decidedAt": "1970-01-01T00:00:00Z",
                }
            ],
        )
        self.assertIn("張三", next_publication["entities"][0]["aliases"])
        self.assertEqual(
            next_batch["baseContentChecksum"],
            next_publication["manifest"]["contentChecksum"],
        )

    def test_stale_candidate_batch_is_rejected(self) -> None:
        publication = _publication()
        with self.assertRaisesRegex(AlignmentError, "checksums"):
            suggest_alignments(_batch("sha256:" + ("f" * 64)), publication)


if __name__ == "__main__":
    unittest.main()
