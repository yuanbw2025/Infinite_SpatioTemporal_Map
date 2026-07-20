"""Failure-path checks for atomic reviewed-candidate publication."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from infinite_spacetime_pipeline.curation import CurationError
from infinite_spacetime_pipeline.publication_identity import with_content_checksum
from infinite_spacetime_pipeline.promotion import promote_candidates_atomically


def _empty_publication() -> dict:
    return with_content_checksum({
        "manifest": {
            "contractVersion": "0.7.0",
            "publicationId": "promotion-test",
            "datasetVersion": "0.0.0",
            "title": "发布测试",
            "generatedAt": "1970-01-01T00:00:00Z",
            "contentChecksum": "sha256:029c1b5a25cb4461002881ef33a9c83933df0bfeb3e2563827230728a0d16f3c",
            "sourceDescription": "测试",
        },
        "sources": [],
        "works": [],
        "editions": [],
        "volumes": [],
        "facsimilePages": [],
        "passages": [],
        "passageAlignments": [],
        "entities": [],
        "mentions": [],
        "assertions": [],
        "places": [],
        "geometries": [],
        "occurrences": [],
    })


def _batch(base_checksum: str) -> dict:
    return {
        "version": 1,
        "publicationId": "promotion-test",
        "baseContentChecksum": base_checksum,
        "generatorId": "test",
        "generatedAt": "1970-01-01T00:00:00Z",
        "candidates": [
            {
                "id": "candidate-entity-a",
                "kind": "entity",
                "payload": {
                    "id": "entity-a",
                    "type": "person",
                    "preferredName": "张三",
                    "aliases": [],
                },
                "evidence": [{"passageId": "staging-only", "start": 0, "end": 1}],
                "status": "verified",
                "reviewHistory": [],
            }
        ],
    }


class PromotionTest(unittest.TestCase):
    def test_collision_failure_does_not_modify_active_publication(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "publication.json"
            base = _empty_publication()
            batch = _batch(base["manifest"]["contentChecksum"])
            promote_candidates_atomically(base, batch, output)
            before = output.read_bytes()
            active = json.loads(before)
            collision_batch = _batch(active["manifest"]["contentChecksum"])

            with self.assertRaisesRegex(CurationError, "already exists"):
                promote_candidates_atomically(active, collision_batch, output)

            self.assertEqual(output.read_bytes(), before)
            self.assertFalse(list(output.parent.glob("*.tmp")))


if __name__ == "__main__":
    unittest.main()
