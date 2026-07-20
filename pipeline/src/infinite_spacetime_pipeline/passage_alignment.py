"""Suggest and materialize curated cross-edition passage alignments."""

from __future__ import annotations

import copy
import hashlib
import re
import unicodedata
from datetime import UTC, datetime
from typing import Any

from .publication import validate_publication
from .publication_identity import with_content_checksum


class PassageAlignmentError(ValueError):
    """Raised when a passage-alignment batch or decision is inconsistent."""


def _normalized(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return re.sub(r"[\s\-—_·•・,，。.;；:：'‘’\"“”()（）\[\]【】]", "", normalized)


def _stable_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("\0".join(parts).encode()).hexdigest()[:24]
    return f"{prefix}-{digest}"


def _passages_for_edition(
    publication: dict[str, Any], edition_id: str
) -> list[dict[str, Any]]:
    volumes = {
        item["id"]: item
        for item in publication["volumes"]
        if item["editionId"] == edition_id
    }
    passages = [
        item for item in publication["passages"] if item["volumeId"] in volumes
    ]
    return sorted(
        passages,
        key=lambda item: (
            volumes[item["volumeId"]]["sequence"],
            item["sequence"],
            item["id"],
        ),
    )


def _match_key(
    passage: dict[str, Any], volumes: dict[str, dict[str, Any]]
) -> tuple[str, str] | None:
    section = passage.get("sectionLabel")
    if not isinstance(section, str) or not _normalized(section):
        return None
    volume = volumes[passage["volumeId"]]
    return _normalized(volume["label"]), _normalized(section)


def suggest_passage_alignments(
    publication: dict[str, Any],
    *,
    work_id: str,
    left_edition_id: str,
    right_edition_id: str,
    generator_id: str,
    generated_at: str | None = None,
) -> dict[str, Any]:
    """Create conservative, checksum-bound 1:1 suggestions for human review."""

    validate_publication(publication)
    if left_edition_id == right_edition_id:
        raise PassageAlignmentError("left and right editions must differ")
    editions = {item["id"]: item for item in publication["editions"]}
    for edition_id in (left_edition_id, right_edition_id):
        edition = editions.get(edition_id)
        if edition is None or edition["workId"] != work_id:
            raise PassageAlignmentError(
                f"edition {edition_id} does not belong to work {work_id}"
            )
    volumes = {item["id"]: item for item in publication["volumes"]}
    left = _passages_for_edition(publication, left_edition_id)
    right = _passages_for_edition(publication, right_edition_id)
    right_by_key: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for passage in right:
        key = _match_key(passage, volumes)
        if key is not None:
            right_by_key.setdefault(key, []).append(passage)

    def review_passage(item: dict[str, Any]) -> dict[str, Any]:
        value = {
            "id": item["id"],
            "volumeLabel": volumes[item["volumeId"]]["label"],
            "sequence": item["sequence"],
            "textOriginal": item["text"]["original"],
        }
        if item.get("sectionLabel"):
            value["sectionLabel"] = item["sectionLabel"]
        return value

    used_right: set[str] = set()
    items: list[dict[str, Any]] = []
    for position, left_passage in enumerate(left):
        key = _match_key(left_passage, volumes)
        exact = [
            item
            for item in right_by_key.get(key, [])
            if item["id"] not in used_right
        ] if key is not None else []
        right_passage: dict[str, Any] | None = exact[0] if len(exact) == 1 else None
        reasons: list[str] = []
        confidence = 0.0
        if right_passage is not None:
            reasons = ["卷标与章节标题规范化后相同"]
            confidence = 0.96
        elif position < len(right) and right[position]["id"] not in used_right:
            right_passage = right[position]
            reasons = ["两版本中的卷次与段落顺序相同，需人工核对"]
            confidence = 0.55
        if right_passage is None:
            continue
        used_right.add(right_passage["id"])
        item_id = _stable_id(
            "passage-alignment-suggestion",
            publication["manifest"]["publicationId"],
            left_passage["id"],
            right_passage["id"],
        )
        items.append(
            {
                "id": item_id,
                "leftPassageIds": [left_passage["id"]],
                "rightPassageIds": [right_passage["id"]],
                "suggestedRelation": (
                    "equivalent" if confidence >= 0.9 else "uncertain"
                ),
                "confidence": confidence,
                "reasons": reasons,
            }
        )
    return {
        "version": 1,
        "publicationId": publication["manifest"]["publicationId"],
        "baseContentChecksum": publication["manifest"]["contentChecksum"],
        "workId": work_id,
        "leftEditionId": left_edition_id,
        "rightEditionId": right_edition_id,
        "generatorId": generator_id,
        "generatedAt": generated_at or datetime.now(UTC).isoformat(),
        "leftPassages": [review_passage(item) for item in left],
        "rightPassages": [review_passage(item) for item in right],
        "items": items,
    }


def _require_id_list(
    value: Any, field: str, passage_ids: set[str]
) -> list[str]:
    if (
        not isinstance(value, list)
        or not value
        or not all(isinstance(item, str) and item for item in value)
        or len(set(value)) != len(value)
    ):
        raise PassageAlignmentError(f"{field} must be a non-empty unique id list")
    unknown = sorted(set(value) - passage_ids)
    if unknown:
        raise PassageAlignmentError(f"{field} contains unknown passages: {unknown}")
    return value


def _next_dataset_version(version: str) -> str:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?", version)
    if not match:
        raise PassageAlignmentError("manifest.datasetVersion is invalid")
    major, minor, patch = (int(item) for item in match.groups())
    return f"{major}.{minor}.{patch + 1}"


def apply_passage_alignment_decisions(
    publication: dict[str, Any],
    batch: dict[str, Any],
    decisions: list[Any],
) -> dict[str, Any]:
    """Materialize a complete human decision set into the canonical collection."""

    validate_publication(publication)
    manifest = publication["manifest"]
    if batch.get("publicationId") != manifest["publicationId"]:
        raise PassageAlignmentError("batch and publication ids do not match")
    if batch.get("baseContentChecksum") != manifest["contentChecksum"]:
        raise PassageAlignmentError("batch is stale for this publication checksum")
    items = batch.get("items")
    if not isinstance(items, list):
        raise PassageAlignmentError("batch.items must be an array")
    items_by_id = {
        item.get("id"): item for item in items if isinstance(item, dict)
    }
    if len(items_by_id) != len(items) or None in items_by_id:
        raise PassageAlignmentError("batch contains invalid or duplicate item ids")
    if not isinstance(decisions, list):
        raise PassageAlignmentError("decisions must be an array")
    decisions_by_id: dict[str, dict[str, Any]] = {}
    for index, decision in enumerate(decisions):
        if not isinstance(decision, dict):
            raise PassageAlignmentError(f"decision[{index}] must be an object")
        suggestion_id = decision.get("suggestionId")
        if suggestion_id not in items_by_id or suggestion_id in decisions_by_id:
            raise PassageAlignmentError(
                f"decision[{index}] has unknown or duplicate suggestionId"
            )
        decisions_by_id[suggestion_id] = decision
    missing = sorted(set(items_by_id) - set(decisions_by_id))
    if missing:
        raise PassageAlignmentError(
            "decisions must cover the complete batch; missing: " + ", ".join(missing)
        )

    work_id = batch.get("workId")
    left_edition_id = batch.get("leftEditionId")
    right_edition_id = batch.get("rightEditionId")
    edition_work = {item["id"]: item["workId"] for item in publication["editions"]}
    if (
        not isinstance(work_id, str)
        or edition_work.get(left_edition_id) != work_id
        or edition_work.get(right_edition_id) != work_id
        or left_edition_id == right_edition_id
    ):
        raise PassageAlignmentError("batch edition/work boundary is invalid")
    passage_ids = {item["id"] for item in publication["passages"]}
    relations = {"equivalent", "partial_overlap", "reordered", "uncertain"}
    statuses = {"reviewed", "verified", "disputed"}
    alignments: list[dict[str, Any]] = []
    for item in items:
        decision = decisions_by_id[item["id"]]
        resolution = decision.get("resolution")
        if resolution == "reject":
            continue
        if resolution not in {"accept", "modify"}:
            raise PassageAlignmentError(
                f"decision for {item['id']} has invalid resolution"
            )
        left_ids = _require_id_list(
            decision.get("leftPassageIds")
            if resolution == "modify"
            else item.get("leftPassageIds"),
            "leftPassageIds",
            passage_ids,
        )
        right_ids = _require_id_list(
            decision.get("rightPassageIds")
            if resolution == "modify"
            else item.get("rightPassageIds"),
            "rightPassageIds",
            passage_ids,
        )
        relation = (
            decision.get("relation")
            if resolution == "modify"
            else decision.get("relation", item.get("suggestedRelation"))
        )
        status = decision.get("reviewStatus")
        reviewer = decision.get("reviewer")
        reviewed_at = decision.get("decidedAt")
        if relation not in relations:
            raise PassageAlignmentError(f"invalid relation for {item['id']}")
        if status not in statuses:
            raise PassageAlignmentError(f"invalid reviewStatus for {item['id']}")
        if not isinstance(reviewer, str) or not reviewer.strip():
            raise PassageAlignmentError(f"reviewer is required for {item['id']}")
        if not isinstance(reviewed_at, str) or not reviewed_at:
            raise PassageAlignmentError(f"decidedAt is required for {item['id']}")
        alignment_id = _stable_id(
            "passage-alignment",
            manifest["publicationId"],
            work_id,
            left_edition_id,
            ",".join(left_ids),
            right_edition_id,
            ",".join(right_ids),
        )
        alignment = {
            "id": alignment_id,
            "workId": work_id,
            "relation": relation,
            "members": [
                {"editionId": left_edition_id, "passageIds": left_ids},
                {"editionId": right_edition_id, "passageIds": right_ids},
            ],
            "reviewStatus": status,
            "reviewedBy": reviewer.strip(),
            "reviewedAt": reviewed_at,
            "revision": 1,
        }
        note = decision.get("note")
        if isinstance(note, str) and note.strip():
            alignment["note"] = note.strip()
        alignments.append(alignment)

    output = copy.deepcopy(publication)
    existing_ids = {item["id"] for item in output["passageAlignments"]}
    duplicates = sorted(existing_ids & {item["id"] for item in alignments})
    if duplicates:
        raise PassageAlignmentError(
            "alignments already exist; revise them explicitly: " + ", ".join(duplicates)
        )
    output["passageAlignments"].extend(alignments)
    output["manifest"]["datasetVersion"] = _next_dataset_version(
        output["manifest"]["datasetVersion"]
    )
    output = with_content_checksum(output)
    validate_publication(output)
    return output
