"""Whole-publication checksum and cross-record invariant checks."""

from __future__ import annotations

import json
import unittest
from copy import deepcopy
from pathlib import Path

from infinite_spacetime_pipeline.publication import (
    PublicationValidationError,
    validate_publication,
)
from infinite_spacetime_pipeline.publication_identity import with_content_checksum


PUBLICATION = (
    Path(__file__).resolve().parents[2]
    / "apps"
    / "web"
    / "public"
    / "data"
    / "publication.json"
)


class PublicationTest(unittest.TestCase):
    def test_checked_in_publication_is_valid(self) -> None:
        with PUBLICATION.open("r", encoding="utf-8") as file:
            validate_publication(json.load(file))

    def test_stale_checksum_is_rejected(self) -> None:
        with PUBLICATION.open("r", encoding="utf-8") as file:
            publication = deepcopy(json.load(file))
        publication["manifest"]["title"] = "被修改但未重算校验和"
        with self.assertRaisesRegex(PublicationValidationError, "contentChecksum"):
            validate_publication(publication)

    def test_predicate_value_and_entity_types_are_enforced(self) -> None:
        with PUBLICATION.open("r", encoding="utf-8") as file:
            base = json.load(file)
        base["sources"] = [
            {
                "id": "source-test",
                "kind": "transcription",
                "title": "测试来源",
                "rightsStatement": "test only",
            }
        ]
        base["works"] = [
            {
                "id": "work-test",
                "title": "测试作品",
                "alternativeTitles": [],
                "category": "gazetteer",
                "sourceRefs": [{"sourceId": "source-test"}],
            }
        ]
        base["editions"] = [
            {
                "id": "edition-test",
                "workId": "work-test",
                "label": "测试本",
                "sourceRefs": [{"sourceId": "source-test"}],
            }
        ]
        base["volumes"] = [
            {
                "id": "volume-test",
                "editionId": "edition-test",
                "label": "卷一",
                "sequence": 1,
            }
        ]
        base["passages"] = [
            {
                "id": "passage-test",
                "volumeId": "volume-test",
                "sequence": 1,
                "text": {"original": "甲乙"},
                "facsimileAnchors": [],
                "revision": 1,
            }
        ]
        base["entities"] = [
            {
                "id": "person-a",
                "type": "person",
                "preferredName": "甲",
                "aliases": [],
                "reviewStatus": "verified",
            },
            {
                "id": "artifact-b",
                "type": "artifact",
                "preferredName": "乙",
                "aliases": [],
                "reviewStatus": "verified",
            },
        ]
        base["assertions"] = [
            {
                "id": "assertion-test",
                "subjectId": "person-a",
                "predicate": "heritage.material",
                "objectId": "artifact-b",
                "evidence": [{"passageId": "passage-test", "start": 0, "end": 2}],
                "reviewStatus": "verified",
            }
        ]
        invalid_types = with_content_checksum(base)
        with self.assertRaisesRegex(PublicationValidationError, "subject type"):
            validate_publication(invalid_types)

        invalid_value = deepcopy(base)
        invalid_value["assertions"][0]["predicate"] = "office.held_title"
        invalid_value = with_content_checksum(invalid_value)
        with self.assertRaisesRegex(PublicationValidationError, "literal value"):
            validate_publication(invalid_value)

    def test_source_relations_reject_self_links_and_duplicate_edges(self) -> None:
        with PUBLICATION.open("r", encoding="utf-8") as file:
            base = json.load(file)
        base["sources"] = [
            {
                "id": "source-a",
                "kind": "facsimile",
                "title": "底本",
                "rightsStatement": "test only",
            },
            {
                "id": "source-b",
                "kind": "transcription",
                "title": "整理本",
                "rightsStatement": "test only",
            },
        ]
        relation = {
            "id": "source-relation-a",
            "subjectSourceId": "source-b",
            "relationType": "derived_from",
            "objectSourceId": "source-a",
            "sourceRefs": [{"sourceId": "source-b", "locator": "整理说明"}],
            "evidence": [],
            "reviewStatus": "verified",
        }
        self_link = deepcopy(relation)
        self_link["objectSourceId"] = "source-b"
        base["sourceRelations"] = [self_link]
        with self.assertRaisesRegex(PublicationValidationError, "cannot reference itself"):
            validate_publication(with_content_checksum(base))

        duplicate = deepcopy(relation)
        duplicate["id"] = "source-relation-b"
        base["sourceRelations"] = [relation, duplicate]
        with self.assertRaisesRegex(PublicationValidationError, "Duplicate source relation"):
            validate_publication(with_content_checksum(base))


if __name__ == "__main__":
    unittest.main()
