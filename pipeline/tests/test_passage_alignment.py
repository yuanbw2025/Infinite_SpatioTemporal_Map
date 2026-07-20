"""Curated passage alignment must remain reviewable and publication-bound."""

from __future__ import annotations

import unittest

from infinite_spacetime_pipeline.passage_alignment import (
    PassageAlignmentError,
    apply_passage_alignment_decisions,
    suggest_passage_alignments,
)
from infinite_spacetime_pipeline.publication_identity import with_content_checksum
from infinite_spacetime_pipeline.publication import PublicationValidationError


def _publication() -> dict:
    passages = [
        {
            "id": passage_id,
            "volumeId": volume_id,
            "sectionLabel": label,
            "sequence": sequence,
            "text": {"original": text},
            "facsimileAnchors": [],
            "revision": 1,
        }
        for passage_id, volume_id, label, sequence, text in (
            ("passage-left-1", "volume-left", "人物", 0, "甲"),
            ("passage-left-2", "volume-left", "山川", 1, "乙"),
            ("passage-right-1", "volume-right", "人物", 0, "甲本"),
            ("passage-right-2", "volume-right", "山川", 1, "乙本上"),
            ("passage-right-3", "volume-right", "山川附", 2, "乙本下"),
        )
    ]
    return with_content_checksum(
        {
            "manifest": {
                "contractVersion": "0.6.0",
                "publicationId": "passage-alignment-test",
                "datasetVersion": "0.0.0",
                "title": "篇章对齐测试",
                "generatedAt": "1970-01-01T00:00:00Z",
                "contentChecksum": "sha256:" + ("0" * 64),
                "sourceDescription": "测试",
            },
            "sources": [
                {
                    "id": "source-text",
                    "kind": "transcription",
                    "title": "测试文本",
                    "rightsStatement": "测试",
                }
            ],
            "works": [
                {
                    "id": "work-a",
                    "title": "测试方志",
                    "alternativeTitles": [],
                    "category": "gazetteer",
                    "sourceRefs": [{"sourceId": "source-text"}],
                }
            ],
            "editions": [
                {
                    "id": "edition-left",
                    "workId": "work-a",
                    "label": "甲本",
                    "sourceRefs": [{"sourceId": "source-text"}],
                },
                {
                    "id": "edition-right",
                    "workId": "work-a",
                    "label": "乙本",
                    "sourceRefs": [{"sourceId": "source-text"}],
                },
            ],
            "volumes": [
                {
                    "id": "volume-left",
                    "editionId": "edition-left",
                    "label": "卷一",
                    "sequence": 0,
                },
                {
                    "id": "volume-right",
                    "editionId": "edition-right",
                    "label": "卷一",
                    "sequence": 0,
                },
            ],
            "facsimilePages": [],
            "passages": passages,
            "passageAlignments": [],
            "entities": [],
            "mentions": [],
            "assertions": [],
            "places": [],
            "geometries": [],
            "occurrences": [],
        }
    )


class PassageAlignmentTest(unittest.TestCase):
    def test_modified_one_to_many_decision_becomes_canonical_fact(self) -> None:
        publication = _publication()
        batch = suggest_passage_alignments(
            publication,
            work_id="work-a",
            left_edition_id="edition-left",
            right_edition_id="edition-right",
            generator_id="test-v1",
            generated_at="1970-01-01T00:00:00Z",
        )
        self.assertEqual(len(batch["items"]), 2)
        decisions = [
            {
                "suggestionId": batch["items"][0]["id"],
                "resolution": "accept",
                "reviewStatus": "verified",
                "reviewer": "tester",
                "decidedAt": "1970-01-01T00:00:00Z",
            },
            {
                "suggestionId": batch["items"][1]["id"],
                "resolution": "modify",
                "relation": "partial_overlap",
                "leftPassageIds": ["passage-left-2"],
                "rightPassageIds": ["passage-right-2", "passage-right-3"],
                "reviewStatus": "reviewed",
                "reviewer": "tester",
                "decidedAt": "1970-01-01T00:00:00Z",
                "note": "乙本拆为两段",
            },
        ]
        result = apply_passage_alignment_decisions(publication, batch, decisions)
        self.assertEqual(result["manifest"]["datasetVersion"], "0.0.1")
        self.assertEqual(len(result["passageAlignments"]), 2)
        self.assertEqual(
            result["passageAlignments"][1]["members"][1]["passageIds"],
            ["passage-right-2", "passage-right-3"],
        )

    def test_incomplete_or_stale_decisions_are_rejected(self) -> None:
        publication = _publication()
        batch = suggest_passage_alignments(
            publication,
            work_id="work-a",
            left_edition_id="edition-left",
            right_edition_id="edition-right",
            generator_id="test-v1",
        )
        with self.assertRaisesRegex(PassageAlignmentError, "complete batch"):
            apply_passage_alignment_decisions(publication, batch, [])
        stale = {**batch, "baseContentChecksum": "sha256:" + ("f" * 64)}
        with self.assertRaisesRegex(PassageAlignmentError, "stale"):
            apply_passage_alignment_decisions(publication, stale, [])

    def test_cross_edition_passage_is_rejected_by_publication_semantics(self) -> None:
        publication = _publication()
        batch = suggest_passage_alignments(
            publication,
            work_id="work-a",
            left_edition_id="edition-left",
            right_edition_id="edition-right",
            generator_id="test-v1",
        )
        decisions = [
            {
                "suggestionId": item["id"],
                "resolution": "modify",
                "relation": "equivalent",
                "leftPassageIds": item["leftPassageIds"],
                "rightPassageIds": ["passage-left-1"],
                "reviewStatus": "reviewed",
                "reviewer": "tester",
                "decidedAt": "1970-01-01T00:00:00Z",
            }
            for item in batch["items"]
        ]
        with self.assertRaisesRegex(PublicationValidationError, "invalid passage"):
            apply_passage_alignment_decisions(publication, batch, decisions)


if __name__ == "__main__":
    unittest.main()
