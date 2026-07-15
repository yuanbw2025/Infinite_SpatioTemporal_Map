"""Command-line entry points for assembling and validating publication data."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .publication import (
    PublicationValidationError,
    assemble_publication,
    validate_publication,
    write_publication,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="infinite-spacetime-data")
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate", help="validate a publication JSON")
    validate.add_argument("publication", type=Path)

    assemble = commands.add_parser(
        "assemble", help="assemble manifest and collection JSON files"
    )
    assemble.add_argument("source_dir", type=Path)
    assemble.add_argument("output", type=Path)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "validate":
            with args.publication.open("r", encoding="utf-8") as file:
                validate_publication(json.load(file))
            print(f"Valid publication: {args.publication}")
        elif args.command == "assemble":
            publication = assemble_publication(args.source_dir)
            write_publication(publication, args.output)
            print(f"Published: {args.output}")
    except (OSError, json.JSONDecodeError, PublicationValidationError) as error:
        print(f"Publication failed: {error}")
        return 1
    return 0
