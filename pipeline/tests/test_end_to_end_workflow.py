"""A deterministic fictional record proves the complete data-production loop."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from infinite_spacetime_pipeline.curation import (
    apply_review_decisions,
    create_candidate_batch,
)
from infinite_spacetime_pipeline.extractors import extract_mention_proposals
from infinite_spacetime_pipeline.promotion import promote_candidates_atomically
from infinite_spacetime_pipeline.publication import validate_publication
from infinite_spacetime_pipeline.publication_identity import with_content_checksum
from infinite_spacetime_pipeline.segmentation import add_text_layer, segment_text


class EndToEndWorkflowTest(unittest.TestCase):
    def test_source_to_reviewed_publication_is_reproducible(self) -> None:
        original = "沈舟至云川。"
        segmentation = segment_text(
            publication_id="fictional-e2e",
            source_key="work-1/edition-1/volume-1",
            source_sha256="0" * 64,
            text=original,
        ).to_dict()
        passage_id = segmentation["segments"][0]["id"]
        layered = add_text_layer(
            segmentation,
            layer="simplified",
            values={passage_id: original},
        )
        base = with_content_checksum(
            {
                "manifest": {
                    "contractVersion": "0.8.0",
                    "publicationId": "fictional-e2e",
                    "datasetVersion": "0.0.0-test",
                    "title": "虚构端到端测试",
                    "generatedAt": "1970-01-01T00:00:00Z",
                    "contentChecksum": "sha256:" + "0" * 64,
                    "sourceDescription": "仅用于架构验收的虚构数据",
                },
                "sources": [
                    {
                        "id": "source-1",
                        "kind": "transcription",
                        "title": "虚构文本",
                        "rightsStatement": "Fictional test fixture",
                    }
                ],
                "sourceRelations": [],
                "works": [
                    {
                        "id": "work-1",
                        "title": "云川县志",
                        "alternativeTitles": [],
                        "category": "gazetteer",
                        "sourceRefs": [{"sourceId": "source-1"}],
                    }
                ],
                "editions": [
                    {
                        "id": "edition-1",
                        "workId": "work-1",
                        "label": "虚构测试本",
                        "sourceRefs": [{"sourceId": "source-1"}],
                    }
                ],
                "volumes": [
                    {
                        "id": "volume-1",
                        "editionId": "edition-1",
                        "label": "卷一",
                        "sequence": 1,
                    }
                ],
                "facsimilePages": [],
                "passages": [
                    {
                        "id": passage_id,
                        "volumeId": "volume-1",
                        "sequence": 1,
                        "text": layered["segments"][0]["text"],
                        "facsimileAnchors": [],
                        "revision": 1,
                    }
                ],
                "passageAlignments": [],
                "entities": [
                    {
                        "id": "person-1",
                        "type": "person",
                        "preferredName": "沈舟",
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
        validate_publication(base)

        proposals = extract_mention_proposals(
            layered,
            [{"entityId": "person-1", "names": ["沈舟"]}],
        )
        first_batch = create_candidate_batch(
            proposals,
            publication_id="fictional-e2e",
            base_content_checksum=base["manifest"]["contentChecksum"],
            generator_id="exact-mention-test-v1",
            generated_at="1970-01-01T00:00:00Z",
        )
        second_batch = create_candidate_batch(
            proposals,
            publication_id="fictional-e2e",
            base_content_checksum=base["manifest"]["contentChecksum"],
            generator_id="exact-mention-test-v1",
            generated_at="1970-01-01T00:00:00Z",
        )
        self.assertEqual(first_batch, second_batch)

        reviewed = apply_review_decisions(
            first_batch,
            [
                {
                    "candidateId": first_batch["candidates"][0]["id"],
                    "status": "verified",
                    "reviewer": "test-suite",
                    "decidedAt": "1970-01-01T00:00:00Z",
                }
            ],
        )
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "publication.json"
            report = promote_candidates_atomically(base, reviewed, output)
            published = json.loads(output.read_text(encoding="utf-8"))

        validate_publication(published)
        self.assertEqual(report["promotedCounts"]["mentions"], 1)
        self.assertEqual(published["passages"][0]["text"]["original"], original)
        self.assertEqual(published["mentions"][0]["surface"], "沈舟")
        self.assertEqual(published["mentions"][0]["reviewStatus"], "verified")


if __name__ == "__main__":
    unittest.main()
