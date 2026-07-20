"""CLI registration and execution for collaboration and release operations."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .collaboration import merge_decision_bundles
from .intake import SourceManifestError, verify_source_manifest
from .release import evaluate_release_gate
from .release_registry import activate_release, register_release


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.write("\n")


def configure_release_commands(commands: Any) -> None:
    merge = commands.add_parser(
        "merge-decision-bundles",
        help="merge version-bound human decisions without last-write-wins",
    )
    merge.add_argument("bundles", type=Path, nargs="+")
    merge.add_argument("output", type=Path)
    merge.add_argument("--report", type=Path)

    gate = commands.add_parser(
        "gate", help="evaluate whether a publication is safe for formal release"
    )
    gate.add_argument("publication", type=Path)
    gate.add_argument("--source-manifest", type=Path)
    gate.add_argument("--source-dir", type=Path)
    gate.add_argument("--candidate-batch", type=Path)
    gate.add_argument("--output", type=Path)

    register = commands.add_parser(
        "register-release",
        help="append a validated immutable artifact to a release registry",
    )
    register.add_argument("publication", type=Path)
    register.add_argument("gate_report", type=Path)
    register.add_argument("output", type=Path)
    register.add_argument("--registry", type=Path)
    register.add_argument("--artifact-path", required=True)
    register.add_argument("--actor", required=True)
    register.add_argument("--registered-at", required=True)

    activate = commands.add_parser(
        "activate-release",
        help="activate or roll back by appending a compare-and-swap event",
    )
    activate.add_argument("registry", type=Path)
    activate.add_argument("output", type=Path)
    activate.add_argument("--content-checksum", required=True)
    activate.add_argument("--expected-current-checksum")
    activate.add_argument("--actor", required=True)
    activate.add_argument("--activated-at", required=True)
    activate.add_argument("--reason", required=True)


def run_release_command(args: argparse.Namespace) -> tuple[str, int]:
    if args.command == "merge-decision-bundles":
        merged, report = merge_decision_bundles(
            [_load_json(path) for path in args.bundles]
        )
        if args.report:
            _write_json(args.report, report)
        if merged is None:
            return json.dumps(report, ensure_ascii=False, indent=2), 1
        _write_json(args.output, merged)
        return (
            f"Merged {report['mergedDecisionCount']} decisions: {args.output}",
            0,
        )

    if args.command == "gate":
        if bool(args.source_manifest) != bool(args.source_dir):
            raise SourceManifestError(
                "--source-manifest and --source-dir must be supplied together"
            )
        source_report = (
            verify_source_manifest(
                _load_json(args.source_manifest),
                source_dir=args.source_dir,
                require_publishable_rights=True,
            )
            if args.source_manifest and args.source_dir
            else None
        )
        candidate_batch = (
            _load_json(args.candidate_batch) if args.candidate_batch else None
        )
        report = evaluate_release_gate(
            _load_json(args.publication),
            source_report=source_report,
            candidate_batch=candidate_batch,
        )
        if args.output:
            _write_json(args.output, report)
        return json.dumps(report, ensure_ascii=False, indent=2), (
            0 if report["passed"] else 1
        )

    if args.command == "register-release":
        registry = _load_json(args.registry) if args.registry else None
        result = register_release(
            _load_json(args.publication),
            _load_json(args.gate_report),
            registry,
            artifact_path=args.artifact_path,
            actor=args.actor,
            registered_at=args.registered_at,
        )
        _write_json(args.output, result)
        return f"Registered immutable release: {args.output}", 0

    result = activate_release(
        _load_json(args.registry),
        content_checksum=args.content_checksum,
        expected_current_checksum=args.expected_current_checksum,
        actor=args.actor,
        activated_at=args.activated_at,
        reason=args.reason,
    )
    _write_json(args.output, result)
    return f"Appended release activation: {args.output}", 0
