"""Release registry preserves immutable history and rejects stale activation."""

from __future__ import annotations

import json
import unittest
from copy import deepcopy
from pathlib import Path

from infinite_spacetime_pipeline.publication_identity import with_content_checksum
from infinite_spacetime_pipeline.release_registry import (
    ReleaseRegistryError,
    activate_release,
    current_release_checksum,
    register_release,
)


PUBLICATION = (
    Path(__file__).resolve().parents[2]
    / "apps"
    / "web"
    / "public"
    / "data"
    / "publication.json"
)


class ReleaseRegistryTest(unittest.TestCase):
    def setUp(self) -> None:
        with PUBLICATION.open("r", encoding="utf-8") as file:
            self.publication = json.load(file)
        manifest = self.publication["manifest"]
        self.report = {
            "publicationId": manifest["publicationId"],
            "contentChecksum": manifest["contentChecksum"],
            "passed": True,
            "errors": [],
            "warnings": [],
            "reviewCounts": {},
        }

    def test_register_and_activate_are_append_only(self) -> None:
        registry = register_release(
            self.publication,
            self.report,
            None,
            artifact_path="releases/0.0.2/publication.json",
            actor="release-editor",
            registered_at="2026-07-20T00:00:00Z",
        )
        checksum = self.publication["manifest"]["contentChecksum"]
        active = activate_release(
            registry,
            content_checksum=checksum,
            expected_current_checksum=None,
            actor="release-editor",
            activated_at="2026-07-20T00:01:00Z",
            reason="initial release",
        )
        self.assertEqual(current_release_checksum(active), checksum)
        self.assertEqual(len(registry["activations"]), 0)
        self.assertEqual(len(active["activations"]), 1)

    def test_corrupt_registry_history_is_rejected(self) -> None:
        registry = register_release(
            self.publication,
            self.report,
            None,
            artifact_path="release.json",
            actor="editor",
            registered_at="2026-07-20T00:00:00Z",
        )
        registry["activations"].append(
            {
                "contentChecksum": self.publication["manifest"]["contentChecksum"],
                "previousContentChecksum": "sha256:" + ("0" * 64),
                "activatedAt": "2026-07-20T00:01:00Z",
                "activatedBy": "editor",
                "reason": "corrupt history",
            }
        )
        with self.assertRaisesRegex(ReleaseRegistryError, "continuous chain"):
            current_release_checksum(registry)

    def test_rollback_appends_a_new_activation_for_an_old_artifact(self) -> None:
        first_checksum = self.publication["manifest"]["contentChecksum"]
        registry = register_release(
            self.publication,
            self.report,
            None,
            artifact_path="releases/first.json",
            actor="editor",
            registered_at="2026-07-20T00:00:00Z",
        )
        second = deepcopy(self.publication)
        second["manifest"]["datasetVersion"] = "0.0.3-contract.0.8"
        second["manifest"]["generatedAt"] = "2026-07-20T00:02:00Z"
        second = with_content_checksum(second)
        second_checksum = second["manifest"]["contentChecksum"]
        second_report = {
            **self.report,
            "contentChecksum": second_checksum,
        }
        registry = register_release(
            second,
            second_report,
            registry,
            artifact_path="releases/second.json",
            actor="editor",
            registered_at="2026-07-20T00:03:00Z",
        )
        registry = activate_release(
            registry,
            content_checksum=first_checksum,
            expected_current_checksum=None,
            actor="editor",
            activated_at="2026-07-20T00:04:00Z",
            reason="first",
        )
        registry = activate_release(
            registry,
            content_checksum=second_checksum,
            expected_current_checksum=first_checksum,
            actor="editor",
            activated_at="2026-07-20T00:05:00Z",
            reason="second",
        )
        rolled_back = activate_release(
            registry,
            content_checksum=first_checksum,
            expected_current_checksum=second_checksum,
            actor="editor",
            activated_at="2026-07-20T00:06:00Z",
            reason="rollback",
        )
        self.assertEqual(current_release_checksum(rolled_back), first_checksum)
        self.assertEqual(len(rolled_back["activations"]), 3)

    def test_failed_gate_duplicates_and_stale_activation_are_rejected(self) -> None:
        failed = {**self.report, "passed": False}
        with self.assertRaisesRegex(ReleaseRegistryError, "did not pass"):
            register_release(
                self.publication,
                failed,
                None,
                artifact_path="release.json",
                actor="editor",
                registered_at="2026-07-20T00:00:00Z",
            )
        registry = register_release(
            self.publication,
            self.report,
            None,
            artifact_path="release.json",
            actor="editor",
            registered_at="2026-07-20T00:00:00Z",
        )
        with self.assertRaisesRegex(ReleaseRegistryError, "already registered"):
            register_release(
                self.publication,
                self.report,
                registry,
                artifact_path="release.json",
                actor="editor",
                registered_at="2026-07-20T00:00:00Z",
            )
        checksum = self.publication["manifest"]["contentChecksum"]
        with self.assertRaisesRegex(ReleaseRegistryError, "active release changed"):
            activate_release(
                registry,
                content_checksum=checksum,
                expected_current_checksum="sha256:" + ("0" * 64),
                actor="editor",
                activated_at="2026-07-20T00:01:00Z",
                reason="stale operation",
            )
        with self.assertRaisesRegex(ReleaseRegistryError, "not registered"):
            activate_release(
                registry,
                content_checksum="sha256:" + ("2" * 64),
                expected_current_checksum=None,
                actor="editor",
                activated_at="2026-07-20T00:01:00Z",
                reason="unknown target",
            )


if __name__ == "__main__":
    unittest.main()
