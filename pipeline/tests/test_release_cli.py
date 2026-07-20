"""Collaboration and release commands remain wired into the public CLI."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from infinite_spacetime_pipeline.cli import build_parser
from infinite_spacetime_pipeline.release_cli import run_release_command


def _bundle(identifier: str, reviewer: str) -> dict:
    return {
        "version": 1,
        "bundleId": identifier,
        "workspace": "candidate_review",
        "publicationId": "publication-a",
        "baseContentChecksum": "sha256:" + ("1" * 64),
        "batchKey": "generator:time",
        "createdAt": "2026-07-20T00:00:00Z",
        "createdBy": reviewer,
        "decisions": [
            {
                "candidateId": "candidate-a",
                "status": "verified",
                "reviewer": reviewer,
                "decidedAt": "2026-07-20T00:00:00Z",
            }
        ],
    }


class ReleaseCliTest(unittest.TestCase):
    def test_merge_command_writes_bundle_and_report(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            left = root / "left.json"
            right = root / "right.json"
            output = root / "merged.json"
            report = root / "report.json"
            left.write_text(
                json.dumps(_bundle("left", "甲"), ensure_ascii=False),
                encoding="utf-8",
            )
            right.write_text(
                json.dumps(_bundle("right", "乙"), ensure_ascii=False),
                encoding="utf-8",
            )
            args = build_parser().parse_args(
                [
                    "merge-decision-bundles",
                    str(left),
                    str(right),
                    str(output),
                    "--report",
                    str(report),
                ]
            )
            message, exit_code = run_release_command(args)
            self.assertEqual(exit_code, 0)
            self.assertIn("Merged 1 decisions", message)
            self.assertEqual(
                json.loads(output.read_text(encoding="utf-8"))["workspace"],
                "candidate_review",
            )
            self.assertEqual(
                json.loads(report.read_text(encoding="utf-8"))[
                    "equivalentDecisionCount"
                ],
                1,
            )


if __name__ == "__main__":
    unittest.main()
