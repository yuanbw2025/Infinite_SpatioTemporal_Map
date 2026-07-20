"""Small explicit contract upgrades that do not reinterpret historical facts."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .migration_errors import MigrationError
from .publication import validate_publication
from .publication_identity import with_content_checksum


def _next_dataset_version_for(value: str, contract: str) -> str:
    core = value.split("-", 1)[0]
    parts = core.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise MigrationError(f"Invalid datasetVersion for migration: {value}")
    major, minor, patch = (int(part) for part in parts)
    return f"{major}.{minor}.{patch + 1}-contract.{contract}"


def migrate_0_5_to_0_6(
    value: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Add the canonical curated passage-alignment collection."""

    if not isinstance(value, dict):
        raise MigrationError("0.5 publication must be an object")
    manifest = value.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("contractVersion") != "0.5.0":
        raise MigrationError("input manifest.contractVersion must be 0.5.0")
    if "passageAlignments" in value:
        raise MigrationError("0.5 publication unexpectedly contains passageAlignments")
    publication = deepcopy(value)
    publication["passageAlignments"] = []
    next_manifest = publication["manifest"]
    next_manifest["contractVersion"] = "0.6.0"
    next_manifest["datasetVersion"] = _next_dataset_version_for(
        next_manifest["datasetVersion"], "0.6"
    )
    next_manifest["contentChecksum"] = "sha256:" + ("0" * 64)
    publication = with_content_checksum(publication)
    return publication, {
        "fromContractVersion": "0.5.0",
        "toContractVersion": "0.6.0",
        "createdPassageAlignments": 0,
        "contentChecksum": publication["manifest"]["contentChecksum"],
    }


def migrate_0_6_to_0_7(
    value: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Adopt the expanded gazetteer predicate vocabulary without changing facts."""

    if not isinstance(value, dict):
        raise MigrationError("0.6 publication must be an object")
    manifest = value.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("contractVersion") != "0.6.0":
        raise MigrationError("input manifest.contractVersion must be 0.6.0")
    publication = deepcopy(value)
    next_manifest = publication["manifest"]
    next_manifest["contractVersion"] = "0.7.0"
    next_manifest["datasetVersion"] = _next_dataset_version_for(
        next_manifest["datasetVersion"], "0.7"
    )
    next_manifest["contentChecksum"] = "sha256:" + ("0" * 64)
    publication = with_content_checksum(publication)
    return publication, {
        "fromContractVersion": "0.6.0",
        "toContractVersion": "0.7.0",
        "addedPredicates": [
            "society.population",
            "society.households",
            "society.taxation",
            "society.local_product",
            "society.tribute_product",
            "society.custom",
            "event.kind",
        ],
        "contentChecksum": publication["manifest"]["contentChecksum"],
    }


def migrate_0_7_to_0_8(
    value: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Add the canonical source-relation collection without inferring relations."""

    if not isinstance(value, dict):
        raise MigrationError("0.7 publication must be an object")
    manifest = value.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("contractVersion") != "0.7.0":
        raise MigrationError("input manifest.contractVersion must be 0.7.0")
    if "sourceRelations" in value:
        raise MigrationError("0.7 publication unexpectedly contains sourceRelations")
    publication = deepcopy(value)
    publication["sourceRelations"] = []
    next_manifest = publication["manifest"]
    next_manifest["contractVersion"] = "0.8.0"
    next_manifest["datasetVersion"] = _next_dataset_version_for(
        next_manifest["datasetVersion"], "0.8"
    )
    next_manifest["contentChecksum"] = "sha256:" + ("0" * 64)
    publication = with_content_checksum(publication)
    validate_publication(publication)
    return publication, {
        "fromContractVersion": "0.7.0",
        "toContractVersion": "0.8.0",
        "createdSourceRelations": 0,
        "contentChecksum": publication["manifest"]["contentChecksum"],
    }
