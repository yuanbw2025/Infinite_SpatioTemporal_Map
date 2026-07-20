"""CLI registration and execution for curated passage alignment."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .collaboration import decisions_from
from .passage_alignment import (
    PassageAlignmentError,
    apply_passage_alignment_decisions,
    suggest_passage_alignments,
)
from .publication import write_publication


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.write("\n")


def configure_passage_alignment_commands(
    commands: Any,
) -> None:
    suggest = commands.add_parser(
        "suggest-passage-alignments",
        help="suggest checksum-bound cross-edition passage matches for review",
    )
    suggest.add_argument("publication", type=Path)
    suggest.add_argument("output", type=Path)
    suggest.add_argument("--work-id", required=True)
    suggest.add_argument("--left-edition-id", required=True)
    suggest.add_argument("--right-edition-id", required=True)
    suggest.add_argument("--generator-id", required=True)

    apply = commands.add_parser(
        "apply-passage-alignments",
        help="materialize complete human passage-alignment decisions",
    )
    apply.add_argument("publication", type=Path)
    apply.add_argument("batch", type=Path)
    apply.add_argument("decisions", type=Path)
    apply.add_argument("output", type=Path)


def run_passage_alignment_command(args: argparse.Namespace) -> str:
    if args.command == "suggest-passage-alignments":
        result = suggest_passage_alignments(
            _load_json(args.publication),
            work_id=args.work_id,
            left_edition_id=args.left_edition_id,
            right_edition_id=args.right_edition_id,
            generator_id=args.generator_id,
        )
        _write_json(args.output, result)
        return f"Prepared {len(result['items'])} passage alignment items: {args.output}"
    decisions = decisions_from(_load_json(args.decisions), "passage_alignment")
    result = apply_passage_alignment_decisions(
        _load_json(args.publication),
        _load_json(args.batch),
        decisions,
    )
    write_publication(result, args.output)
    return f"Materialized {len(decisions)} passage decisions: {args.output}"
