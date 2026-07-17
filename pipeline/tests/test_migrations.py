"""Regression tests for explicit wire-contract migrations."""

from __future__ import annotations

import unittest

from infinite_spacetime_pipeline.migrations import (
    MigrationError,
    migrate_0_3_to_0_4,
)


def _old_publication() -> dict:
    return {
        "manifest": {
            "contractVersion": "0.3.0",
            "publicationId": "migration-example",
            "title": "迁移样本",
            "generatedAt": "1970-01-01T00:00:00Z",
            "sourceDescription": "测试来源",
        },
        "works": [
            {
                "id": "work-a",
                "title": "某县志",
                "alternativeTitles": [],
                "category": "gazetteer",
                "describedRegion": "某县",
            }
        ],
        "editions": [
            {
                "id": "edition-a",
                "workId": "work-a",
                "label": "测试本",
                "holdingInstitution": "测试馆",
                "sourceUrl": "https://example.org/book",
                "rightsStatement": "Public domain",
            }
        ],
        "volumes": [
            {
                "id": "volume-a",
                "editionId": "edition-a",
                "label": "卷一",
                "sequence": 0,
            }
        ],
        "passages": [
            {
                "id": "passage-a",
                "source": {
                    "workId": "work-a",
                    "editionId": "edition-a",
                    "volumeId": "volume-a",
                    "volumeLabel": "卷一",
                    "sectionLabel": "人物",
                    "pageId": "page-1",
                    "passageId": "passage-a",
                },
                "sequence": 0,
                "text": {"original": "张三居某县。"},
                "facsimile": {
                    "pageId": "page-1",
                    "imageUrl": "https://example.org/page-1.jpg",
                },
                "revision": 1,
            }
        ],
        "entities": [
            {
                "id": "entity-person",
                "type": "person",
                "preferredName": "张三",
                "aliases": [],
            },
            {
                "id": "entity-place",
                "type": "place",
                "preferredName": "某县",
                "aliases": [],
            },
        ],
        "mentions": [
            {
                "id": "mention-a",
                "passageId": "passage-a",
                "entityId": "entity-person",
                "start": 0,
                "end": 2,
                "surface": "张三",
                "reviewStatus": "reviewed",
            }
        ],
        "assertions": [
            {
                "id": "assertion-a",
                "subjectId": "entity-person",
                "predicate": "residedAt",
                "objectId": "entity-place",
                "evidence": [{"passageId": "passage-a", "start": 0, "end": 6}],
                "reviewStatus": "reviewed",
            }
        ],
        "places": [
            {
                "id": "place-a",
                "entityId": "entity-place",
                "preferredName": "某县旧称",
                "historicalNames": [{"name": "某县"}],
                "parentPlaceIds": [],
            }
        ],
        "geometries": [
            {
                "id": "geometry-a",
                "placeId": "place-a",
                "geometry": {"type": "Point", "coordinates": [120, 30]},
                "precision": "settlement",
                "reviewStatus": "reviewed",
            }
        ],
        "occurrences": [
            {
                "id": "occurrence-a",
                "entityId": "entity-person",
                "placeId": "place-a",
                "kind": "residence",
                "evidence": [{"passageId": "passage-a", "start": 0, "end": 6}],
                "reviewStatus": "reviewed",
            }
        ],
    }


class MigrationTest(unittest.TestCase):
    def test_0_3_to_0_4_moves_ownership_without_losing_labels(self) -> None:
        publication, report = migrate_0_3_to_0_4(_old_publication())

        self.assertEqual(publication["manifest"]["contractVersion"], "0.4.0")
        self.assertEqual(report["createdSources"], 1)
        self.assertEqual(report["createdFacsimilePages"], 1)
        self.assertNotIn("describedRegion", publication["works"][0])
        self.assertEqual(publication["works"][0]["coverage"]["regionLabels"], ["某县"])
        self.assertNotIn("source", publication["passages"][0])
        self.assertNotIn("preferredName", publication["places"][0])
        self.assertIn("某县旧称", publication["entities"][1]["aliases"])
        self.assertEqual(publication["entities"][0]["reviewStatus"], "raw")

    def test_missing_rights_is_not_silently_invented(self) -> None:
        old = _old_publication()
        del old["editions"][0]["rightsStatement"]
        with self.assertRaisesRegex(MigrationError, "rightsStatement"):
            migrate_0_3_to_0_4(old)


if __name__ == "__main__":
    unittest.main()
