"""Deterministic merge of version-bound human decision bundles."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from typing import Any


class CollaborationError(ValueError):
    """Raised when collaboration bundles are malformed, mixed, or conflicting."""


ID_FIELDS = {
    "candidate_review": "candidateId",
    "entity_alignment": "alignmentId",
    "passage_alignment": "suggestionId",
}


def _require_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise CollaborationError(f"{field} must be a non-empty string")
    return value


def _validate_bundle(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or value.get("version") != 1:
        raise CollaborationError("decision bundle must be a version 1 object")
    workspace = value.get("workspace")
    if workspace not in ID_FIELDS:
        raise CollaborationError("decision bundle has an unknown workspace")
    for field in (
        "bundleId",
        "publicationId",
        "baseContentChecksum",
        "batchKey",
        "createdAt",
        "createdBy",
    ):
        _require_text(value.get(field), field)
    decisions = value.get("decisions")
    if not isinstance(decisions, list):
        raise CollaborationError("decision bundle requires a decisions array")
    source_ids = value.get("sourceBundleIds")
    if source_ids is not None and (
        not isinstance(source_ids, list)
        or not all(isinstance(item, str) and item for item in source_ids)
        or len(source_ids) != len(set(source_ids))
    ):
        raise CollaborationError("sourceBundleIds must contain unique non-empty strings")
    own_ids: set[str] = set()
    id_field = ID_FIELDS[workspace]
    for decision in decisions:
        if not isinstance(decision, dict):
            raise CollaborationError("each decision must be an object")
        identifier = _require_text(decision.get(id_field), id_field)
        _require_text(decision.get("reviewer"), "reviewer")
        _require_text(decision.get("decidedAt"), "decidedAt")
        if identifier in own_ids:
            raise CollaborationError(
                f"decision bundle {value['bundleId']} repeats {identifier}"
            )
        own_ids.add(identifier)
    return value


def _outcome(decision: dict[str, Any]) -> str:
    substantive = {
        key: value
        for key, value in decision.items()
        if key not in {"reviewer", "decidedAt"}
    }
    return json.dumps(
        substantive, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )


def merge_decision_bundles(
    values: list[Any],
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Merge equal outcomes and report all substantive conflicts without overwrite."""

    if not values:
        raise CollaborationError("at least one decision bundle is required")
    bundles = sorted(
        (_validate_bundle(value) for value in values),
        key=lambda bundle: bundle["bundleId"],
    )
    first = bundles[0]
    scope_fields = (
        "workspace",
        "publicationId",
        "baseContentChecksum",
        "batchKey",
    )
    scope = tuple(first[field] for field in scope_fields)
    if any(tuple(bundle[field] for field in scope_fields) != scope for bundle in bundles):
        raise CollaborationError(
            "decision bundles do not share publication, checksum, workspace, and batch"
        )
    source_ids = sorted(bundle["bundleId"] for bundle in bundles)
    provenance_ids = sorted(
        {
            identifier
            for bundle in bundles
            for identifier in (
                bundle["bundleId"],
                *bundle.get("sourceBundleIds", []),
            )
        }
    )
    if len(set(source_ids)) != len(source_ids):
        raise CollaborationError("decision bundles contain duplicate bundleId")

    id_field = ID_FIELDS[first["workspace"]]
    groups: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    for bundle in bundles:
        for decision in bundle["decisions"]:
            groups.setdefault(decision[id_field], []).append(
                (bundle["bundleId"], decision)
            )

    decisions: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    contributors: dict[str, list[dict[str, str]]] = {}
    equivalent_count = 0
    for identifier in sorted(groups):
        variants = groups[identifier]
        outcomes = {_outcome(decision) for _, decision in variants}
        if len(outcomes) > 1:
            conflicts.append(
                {
                    "decisionId": identifier,
                    "variants": [
                        {
                            "sourceBundleId": bundle_id,
                            "reviewer": decision["reviewer"],
                            "decidedAt": decision["decidedAt"],
                            "decision": deepcopy(decision),
                        }
                        for bundle_id, decision in variants
                    ],
                }
            )
            continue
        equivalent_count += len(variants) - 1
        selected = min(
            variants,
            key=lambda item: (
                item[1]["decidedAt"],
                item[1]["reviewer"],
                item[0],
            ),
        )[1]
        decisions.append(deepcopy(selected))
        contributors[identifier] = [
            {
                "sourceBundleId": bundle_id,
                "reviewer": decision["reviewer"],
                "decidedAt": decision["decidedAt"],
            }
            for bundle_id, decision in variants
        ]

    report = {
        "sourceBundleIds": source_ids,
        "mergedDecisionCount": len(decisions),
        "equivalentDecisionCount": equivalent_count,
        "contributors": contributors,
        "conflicts": conflicts,
    }
    if conflicts:
        return None, report
    digest = hashlib.sha256("\0".join(source_ids).encode()).hexdigest()[:20]
    merged = {
        "version": 1,
        "bundleId": f"merged:{digest}",
        "workspace": first["workspace"],
        "publicationId": first["publicationId"],
        "baseContentChecksum": first["baseContentChecksum"],
        "batchKey": first["batchKey"],
        "createdAt": max(bundle["createdAt"] for bundle in bundles),
        "createdBy": "merge-decision-bundles",
        "sourceBundleIds": provenance_ids,
        "decisions": decisions,
    }
    return merged, report


def decisions_from(value: Any, workspace: str) -> list[dict[str, Any]]:
    """Read decisions from a versioned bundle or a legacy bare array."""

    if isinstance(value, list):
        if not all(isinstance(item, dict) for item in value):
            raise CollaborationError("decisions must contain only objects")
        return value
    bundle = _validate_bundle(value)
    if bundle["workspace"] != workspace:
        raise CollaborationError(
            f"expected {workspace} decisions, found {bundle['workspace']}"
        )
    return bundle["decisions"]
