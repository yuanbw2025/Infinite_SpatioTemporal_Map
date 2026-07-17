"""Assemble and validate the portable knowledge publication."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .contract_schema import (
    ContractSchemaError,
    publication_collections,
    validate_contract_structure,
)
from .publication_identity import with_content_checksum
from .semantic_validation import SemanticValidationError, validate_publication_semantics


class PublicationValidationError(ValueError):
    """Raised when a publication breaks contract or semantic rules."""


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def assemble_publication(source_dir: Path) -> dict[str, Any]:
    """Combine a manifest and collection shards into a checked publication."""

    manifest_path = source_dir / "manifest.json"
    if not manifest_path.exists():
        raise PublicationValidationError(f"Missing {manifest_path}")
    publication: dict[str, Any] = {"manifest": _load_json(manifest_path)}
    for collection in publication_collections():
        path = source_dir / f"{collection}.json"
        publication[collection] = _load_json(path) if path.exists() else []
    output = with_content_checksum(publication)
    validate_publication(output)
    return output


def write_publication(publication: dict[str, Any], output_path: Path) -> None:
    """Write normalized, checked JSON; callers cannot persist a stale checksum."""

    output = with_content_checksum(publication)
    validate_publication(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=2)
        file.write("\n")


def validate_publication(value: Any) -> None:
    """Run canonical structure checks followed by cross-record semantics."""

    try:
        validate_contract_structure(value)
        validate_publication_semantics(value)
    except (ContractSchemaError, SemanticValidationError) as error:
        raise PublicationValidationError(str(error)) from error
