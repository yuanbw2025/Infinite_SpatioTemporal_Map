"""Source inventory, checksums, provenance and rights gates."""

from __future__ import annotations

import hashlib
import json
import mimetypes
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .sources import default_source_registry

RIGHTS_STATUSES = {
    "public_domain",
    "licensed",
    "permission",
    "restricted",
    "unknown",
}


class SourceManifestError(ValueError):
    """Raised when a source inventory is incomplete or no longer reproducible."""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _source_key(relative_path: str) -> str:
    digest = hashlib.sha256(relative_path.encode("utf-8")).hexdigest()[:16]
    return f"source-{digest}"


def load_source_metadata(path: Path | None) -> dict[str, dict[str, Any]]:
    if path is None:
        return {}
    with path.open("r", encoding="utf-8") as file:
        value = json.load(file)
    sources = value.get("sources") if isinstance(value, dict) else None
    if not isinstance(sources, dict) or not all(
        isinstance(key, str) and isinstance(item, dict)
        for key, item in sources.items()
    ):
        raise SourceManifestError("metadata must contain an object named sources")
    return sources


def build_source_manifest(
    source_dir: Path,
    *,
    publication_id: str,
    metadata: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    root = source_dir.expanduser().resolve()
    if not root.is_dir():
        raise SourceManifestError(f"source directory does not exist: {root}")
    if not publication_id.strip():
        raise SourceManifestError("publication_id is required")
    supplied = metadata or {}
    supported = set(default_source_registry().supported_extensions)
    entries: list[dict[str, Any]] = []
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        if path.suffix.lower() not in supported:
            continue
        relative = path.relative_to(root).as_posix()
        details = supplied.get(relative, {})
        rights_status = details.get("rightsStatus", "unknown")
        if rights_status not in RIGHTS_STATUSES:
            raise SourceManifestError(
                f"{relative} has invalid rightsStatus {rights_status!r}"
            )
        checksum = _sha256(path)
        entries.append(
            {
                "sourceKey": details.get("sourceKey", _source_key(relative)),
                "relativePath": relative,
                "sha256": checksum,
                "byteLength": path.stat().st_size,
                "mediaType": mimetypes.guess_type(path.name)[0]
                or "application/octet-stream",
                "rightsStatus": rights_status,
                **(
                    {"rightsStatement": details["rightsStatement"]}
                    if details.get("rightsStatement")
                    else {}
                ),
                **(
                    {"sourceUrl": details["sourceUrl"]}
                    if details.get("sourceUrl")
                    else {}
                ),
                **(
                    {"holdingInstitution": details["holdingInstitution"]}
                    if details.get("holdingInstitution")
                    else {}
                ),
                **(
                    {"notes": details["notes"]}
                    if details.get("notes")
                    else {}
                ),
            }
        )
    if not entries:
        raise SourceManifestError("source directory contains no supported files")
    unknown_metadata = set(supplied) - {entry["relativePath"] for entry in entries}
    if unknown_metadata:
        raise SourceManifestError(
            "metadata references missing or unsupported files: "
            + ", ".join(sorted(unknown_metadata))
        )
    return {
        "version": 1,
        "publicationId": publication_id,
        "generatedAt": datetime.now(UTC).isoformat(),
        "sourceRoot": str(root),
        "sources": entries,
    }


def verify_source_manifest(
    manifest: dict[str, Any],
    *,
    source_dir: Path,
    require_publishable_rights: bool = False,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    if manifest.get("version") != 1:
        errors.append("unsupported source manifest version")
    publication_id = manifest.get("publicationId")
    if not isinstance(publication_id, str) or not publication_id.strip():
        errors.append("source manifest requires publicationId")
    entries = manifest.get("sources")
    if not isinstance(entries, list) or not entries:
        raise SourceManifestError("manifest requires a non-empty sources list")
    root = source_dir.expanduser().resolve()
    source_keys: set[str] = set()
    relative_paths: set[str] = set()
    for index, entry in enumerate(entries):
        owner = f"sources[{index}]"
        if not isinstance(entry, dict):
            errors.append(f"{owner} must be an object")
            continue
        source_key = entry.get("sourceKey")
        relative_path = entry.get("relativePath")
        if not isinstance(source_key, str) or not source_key:
            errors.append(f"{owner} requires sourceKey")
        elif source_key in source_keys:
            errors.append(f"duplicate sourceKey: {source_key}")
        else:
            source_keys.add(source_key)
        if not isinstance(relative_path, str) or not relative_path:
            errors.append(f"{owner} requires relativePath")
            continue
        if relative_path in relative_paths:
            errors.append(f"duplicate relativePath: {relative_path}")
        relative_paths.add(relative_path)
        path = (root / relative_path).resolve()
        try:
            path.relative_to(root)
        except ValueError:
            errors.append(f"{relative_path} escapes the source directory")
            continue
        if not path.is_file():
            errors.append(f"source file is missing: {relative_path}")
            continue
        expected = entry.get("sha256")
        actual = _sha256(path)
        if expected != actual:
            errors.append(f"checksum changed: {relative_path}")
        if entry.get("byteLength") != path.stat().st_size:
            errors.append(f"byte length changed: {relative_path}")
        status = entry.get("rightsStatus")
        if status not in RIGHTS_STATUSES:
            errors.append(f"invalid rights status: {relative_path}")
        elif status == "unknown":
            message = f"rights are unknown: {relative_path}"
            (errors if require_publishable_rights else warnings).append(message)
        elif status == "restricted":
            message = f"source is restricted: {relative_path}"
            (errors if require_publishable_rights else warnings).append(message)
        elif not entry.get("rightsStatement"):
            message = f"rights statement is missing: {relative_path}"
            (errors if require_publishable_rights else warnings).append(message)
    return {
        "passed": not errors,
        "publicationId": publication_id,
        "sourceCount": len(entries),
        "errors": errors,
        "warnings": warnings,
    }
