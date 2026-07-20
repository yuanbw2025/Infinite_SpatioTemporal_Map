"""Formal release requires publication, source, and review gates together."""

from __future__ import annotations

import unittest

from infinite_spacetime_pipeline.publication_identity import with_content_checksum
from infinite_spacetime_pipeline.release import evaluate_release_gate


def _publication() -> dict:
    return with_content_checksum(
        {
            "manifest": {
                "contractVersion": "0.7.0",
                "publicationId": "release-test",
                "datasetVersion": "0.0.0",
                "title": "发布门禁测试",
                "generatedAt": "1970-01-01T00:00:00Z",
                "contentChecksum": "sha256:" + ("0" * 64),
                "sourceDescription": "测试",
            },
            **{
                name: []
                for name in (
                    "sources",
                    "works",
                    "editions",
                    "volumes",
                    "facsimilePages",
                    "passages",
                    "passageAlignments",
                    "entities",
                    "mentions",
                    "assertions",
                    "places",
                    "geometries",
                    "occurrences",
                )
            },
        }
    )


class ReleaseTest(unittest.TestCase):
    def test_verified_empty_release_can_pass_all_supplied_gates(self) -> None:
        publication = _publication()
        report = evaluate_release_gate(
            publication,
            source_report={
                "publicationId": "release-test",
                "passed": True,
                "errors": [],
                "warnings": [],
            },
            candidate_batch={
                "publicationId": "release-test",
                "candidates": [],
            },
        )
        self.assertTrue(report["passed"])

    def test_missing_external_gate_evidence_blocks_release(self) -> None:
        report = evaluate_release_gate(_publication())
        self.assertFalse(report["passed"])
        self.assertGreaterEqual(len(report["errors"]), 2)


if __name__ == "__main__":
    unittest.main()
