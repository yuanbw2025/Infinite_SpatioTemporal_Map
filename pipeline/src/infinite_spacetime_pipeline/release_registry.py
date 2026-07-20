"""Append-only release registration and compare-and-swap activation."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from typing import Any

from .publication import validate_publication


class ReleaseRegistryError(ValueError):
    """Raised when a release registry operation is unsafe or inconsistent."""


def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise ReleaseRegistryError(f"{field} must be a non-empty string")
    return value


def _report_checksum(report: dict[str, Any]) -> str:
    payload = json.dumps(
        report, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def _registry(value: Any, publication_id: str) -> dict[str, Any]:
    if value is None:
        return {
            "version": 1,
            "publicationId": publication_id,
            "releases": [],
            "activations": [],
        }
    if (
        not isinstance(value, dict)
        or value.get("version") != 1
        or value.get("publicationId") != publication_id
        or not isinstance(value.get("releases"), list)
        or not isinstance(value.get("activations"), list)
    ):
        raise ReleaseRegistryError("release registry has an incompatible envelope")
    output = deepcopy(value)
    registered: set[str] = set()
    versions: set[str] = set()
    for release in output["releases"]:
        if not isinstance(release, dict):
            raise ReleaseRegistryError("release registry contains an invalid release")
        checksum = _text(release.get("contentChecksum"), "contentChecksum")
        version = _text(release.get("datasetVersion"), "datasetVersion")
        for field in (
            "contractVersion",
            "generatedAt",
            "artifactPath",
            "gateReportChecksum",
            "registeredAt",
            "registeredBy",
        ):
            _text(release.get(field), field)
        if checksum in registered or version in versions:
            raise ReleaseRegistryError("release registry contains duplicate identities")
        registered.add(checksum)
        versions.add(version)

    current: str | None = None
    for activation in output["activations"]:
        if not isinstance(activation, dict):
            raise ReleaseRegistryError("release registry contains an invalid activation")
        target = _text(activation.get("contentChecksum"), "contentChecksum")
        previous = activation.get("previousContentChecksum")
        if previous is not None:
            _text(previous, "previousContentChecksum")
        for field in ("activatedAt", "activatedBy", "reason"):
            _text(activation.get(field), field)
        if target not in registered:
            raise ReleaseRegistryError("activation references an unregistered release")
        if previous != current:
            raise ReleaseRegistryError("activation history is not a continuous chain")
        current = target
    return output


def register_release(
    publication: dict[str, Any],
    gate_report: dict[str, Any],
    registry: dict[str, Any] | None,
    *,
    artifact_path: str,
    actor: str,
    registered_at: str,
) -> dict[str, Any]:
    """Register one immutable, validated artifact without activating it."""

    validate_publication(publication)
    manifest = publication["manifest"]
    if not isinstance(gate_report, dict) or gate_report.get("passed") is not True:
        raise ReleaseRegistryError("release gate did not pass")
    if (
        gate_report.get("publicationId") != manifest["publicationId"]
        or gate_report.get("contentChecksum") != manifest["contentChecksum"]
    ):
        raise ReleaseRegistryError("release gate report belongs to another publication")
    path = _text(artifact_path, "artifactPath")
    editor = _text(actor, "actor")
    timestamp = _text(registered_at, "registeredAt")
    output = _registry(registry, manifest["publicationId"])
    if any(
        item.get("contentChecksum") == manifest["contentChecksum"]
        for item in output["releases"]
    ):
        raise ReleaseRegistryError("content checksum is already registered")
    if any(
        item.get("datasetVersion") == manifest["datasetVersion"]
        for item in output["releases"]
    ):
        raise ReleaseRegistryError("dataset version is already registered")
    output["releases"].append(
        {
            "datasetVersion": manifest["datasetVersion"],
            "contractVersion": manifest["contractVersion"],
            "contentChecksum": manifest["contentChecksum"],
            "generatedAt": manifest["generatedAt"],
            "artifactPath": path,
            "gateReportChecksum": _report_checksum(gate_report),
            "registeredAt": timestamp,
            "registeredBy": editor,
        }
    )
    return output


def current_release_checksum(registry: dict[str, Any]) -> str | None:
    if not isinstance(registry, dict):
        raise ReleaseRegistryError("release registry must be an object")
    publication_id = _text(registry.get("publicationId"), "publicationId")
    checked = _registry(registry, publication_id)
    activations = checked["activations"]
    return activations[-1]["contentChecksum"] if activations else None


def activate_release(
    registry: dict[str, Any],
    *,
    content_checksum: str,
    expected_current_checksum: str | None,
    actor: str,
    activated_at: str,
    reason: str,
) -> dict[str, Any]:
    """Append an activation only when the caller's observed current value still matches."""

    if not isinstance(registry, dict):
        raise ReleaseRegistryError("release registry must be an object")
    publication_id = _text(registry.get("publicationId"), "publicationId")
    output = _registry(registry, publication_id)
    target = _text(content_checksum, "contentChecksum")
    if not any(item.get("contentChecksum") == target for item in output["releases"]):
        raise ReleaseRegistryError("target release is not registered")
    current = current_release_checksum(output)
    if current != expected_current_checksum:
        raise ReleaseRegistryError(
            f"active release changed: expected {expected_current_checksum!r}, found {current!r}"
        )
    output["activations"].append(
        {
            "contentChecksum": target,
            "previousContentChecksum": current,
            "activatedAt": _text(activated_at, "activatedAt"),
            "activatedBy": _text(actor, "actor"),
            "reason": _text(reason, "reason"),
        }
    )
    return output
