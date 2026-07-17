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


if __name__ == "__main__":
    unittest.main()
