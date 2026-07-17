"""Deterministic publication identity and checksum operations."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from typing import Any


def calculate_content_checksum(publication: dict[str, Any]) -> str:
    """Hash canonical JSON while excluding the checksum field itself."""

    payload = deepcopy(publication)
    manifest = payload.get("manifest")
    if isinstance(manifest, dict):
        manifest.pop("contentChecksum", None)
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


def with_content_checksum(publication: dict[str, Any]) -> dict[str, Any]:
    """Return a deep copy carrying the checksum of its canonical content."""

    output = deepcopy(publication)
    manifest = output.get("manifest")
    if not isinstance(manifest, dict):
        return output
    manifest["contentChecksum"] = calculate_content_checksum(output)
    return output
