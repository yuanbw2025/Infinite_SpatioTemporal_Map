"""Conservative entity/place alignment suggestions and explicit resolution."""

from __future__ import annotations

import copy
import hashlib
import json
import re
import unicodedata
from datetime import UTC, datetime
from typing import Any

from .publication_identity import with_content_checksum


class AlignmentError(ValueError):
    """Raised when alignment inputs or human resolutions are inconsistent."""


def _normalized(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return re.sub(r"[\s\-—_·•・,，。.;；:：'‘’\"“”()（）\[\]【】]", "", normalized)


def _names(value: dict[str, Any], *, place: bool = False) -> set[str]:
    result: set[str] = set()
    preferred = value.get("preferredName")
    if isinstance(preferred, str) and preferred:
        result.add(preferred)
    aliases = value.get("historicalNames") if place else value.get("aliases")
    if isinstance(aliases, list):
        for alias in aliases:
            name = alias.get("name") if isinstance(alias, dict) else alias
            if isinstance(name, str) and name:
                result.add(name)
    return result


def _alignment_id(candidate_id: str, kind: str) -> str:
    digest = hashlib.sha256(f"{kind}\0{candidate_id}".encode()).hexdigest()[:20]
    return f"alignment-{digest}"


def _score_names(source: set[str], target: set[str]) -> tuple[float, list[str]]:
    exact = source & target
    if exact:
        return 1.0, [f"同名：{name}" for name in sorted(exact)]
    source_normalized = {_normalized(name): name for name in source}
    target_normalized = {_normalized(name): name for name in target}
    shared = set(source_normalized) & set(target_normalized)
    if shared:
        descriptions = [
            f"规范化名称相同：{source_normalized[key]} / {target_normalized[key]}"
            for key in sorted(shared)
        ]
        return 0.9, descriptions
    return 0.0, []


def suggest_alignments(
    candidate_batch: dict[str, Any],
    publication: dict[str, Any],
    *,
    aligner_id: str = "exact-name-v1",
) -> dict[str, Any]:
    publication_id = candidate_batch.get("publicationId")
    manifest = publication.get("manifest", {})
    if publication_id != manifest.get("publicationId"):
        raise AlignmentError("candidate batch and publication ids do not match")
    if candidate_batch.get("baseContentChecksum") != manifest.get(
        "contentChecksum"
    ):
        raise AlignmentError("candidate batch and publication checksums do not match")
    candidates = candidate_batch.get("candidates")
    if not isinstance(candidates, list):
        raise AlignmentError("candidate batch has no candidates list")
    existing_entities = publication.get("entities")
    existing_places = publication.get("places")
    if not isinstance(existing_entities, list) or not isinstance(existing_places, list):
        raise AlignmentError("publication has invalid entity or place collections")

    items: list[dict[str, Any]] = []
    for candidate in candidates:
        if not isinstance(candidate, dict) or candidate.get("kind") not in {"entity", "place"}:
            continue
        payload = candidate.get("payload")
        candidate_id = candidate.get("id")
        if not isinstance(payload, dict) or not isinstance(candidate_id, str):
            raise AlignmentError("entity/place candidate has invalid payload or id")
        kind = candidate["kind"]
        is_place = kind == "place"
        source_names = _names(payload, place=is_place)
        if not source_names:
            raise AlignmentError(f"candidate {candidate_id} has no names")
        targets = existing_places if is_place else existing_entities
        matches: list[dict[str, Any]] = []
        for target in targets:
            if not isinstance(target, dict) or not isinstance(target.get("id"), str):
                continue
            if not is_place and payload.get("type") != target.get("type"):
                continue
            score, reasons = _score_names(source_names, _names(target, place=is_place))
            if not score:
                continue
            if is_place:
                source_parents = set(payload.get("parentPlaceIds", []))
                target_parents = set(target.get("parentPlaceIds", []))
                if source_parents and target_parents and source_parents & target_parents:
                    score = min(1.0, score + 0.05)
                    reasons.append("上级地点相同")
            matches.append(
                {
                    "targetId": target["id"],
                    "label": (
                        target.get("preferredName")
                        or next(iter(sorted(_names(target, place=is_place))), None)
                        or target["id"]
                    ),
                    "score": score,
                    "reasons": reasons,
                }
            )
        matches.sort(key=lambda item: (-item["score"], item["targetId"]))
        top = matches[0]["score"] if matches else 0
        second = matches[1]["score"] if len(matches) > 1 else 0
        suggestion = (
            "merge_existing"
            if top >= 0.9 and top - second >= 0.1
            else "create_new"
            if not matches
            else "manual_review"
        )
        label = payload.get("preferredName") or next(
            iter(sorted(_names(payload, place=is_place))), None
        )
        items.append(
            {
                "id": _alignment_id(candidate_id, kind),
                "candidateId": candidate_id,
                "kind": kind,
                "sourceLabel": label if isinstance(label, str) else candidate_id,
                "sourcePayload": payload,
                "matches": matches[:10],
                "suggestion": suggestion,
            }
        )
    return {
        "version": 1,
        "publicationId": publication_id,
        "baseContentChecksum": manifest["contentChecksum"],
        "generatedAt": datetime.now(UTC).isoformat(),
        "alignerId": aligner_id,
        "items": items,
    }


def resolve_alignments(
    candidate_batch: dict[str, Any],
    publication: dict[str, Any],
    alignment_batch: dict[str, Any],
    decisions: list[Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    publication_id = publication.get("manifest", {}).get("publicationId")
    if any(
        value.get("publicationId") != publication_id
        for value in (candidate_batch, alignment_batch)
    ):
        raise AlignmentError("alignment inputs belong to different publications")
    checksum = publication.get("manifest", {}).get("contentChecksum")
    if any(
        value.get("baseContentChecksum") != checksum
        for value in (candidate_batch, alignment_batch)
    ):
        raise AlignmentError("alignment inputs belong to different publication versions")
    candidates = copy.deepcopy(candidate_batch.get("candidates"))
    items = alignment_batch.get("items")
    if not isinstance(candidates, list) or not isinstance(items, list):
        raise AlignmentError("alignment inputs are incomplete")
    candidates_by_id = {
        item.get("id"): item for item in candidates if isinstance(item, dict)
    }
    items_by_id = {item.get("id"): item for item in items if isinstance(item, dict)}
    updated_publication = copy.deepcopy(publication)
    entity_targets = {
        item.get("id"): item for item in updated_publication.get("entities", [])
    }
    place_targets = {
        item.get("id"): item for item in updated_publication.get("places", [])
    }
    decided: set[str] = set()
    for index, decision in enumerate(decisions):
        if not isinstance(decision, dict):
            raise AlignmentError(f"decision[{index}] must be an object")
        alignment_id = decision.get("alignmentId")
        resolution = decision.get("resolution")
        reviewer = decision.get("reviewer")
        if alignment_id not in items_by_id or alignment_id in decided:
            raise AlignmentError(f"decision[{index}] has unknown or duplicate alignmentId")
        decided.add(alignment_id)
        if resolution not in {"merge_existing", "create_new", "keep_separate"}:
            raise AlignmentError(f"decision[{index}] has invalid resolution")
        if not isinstance(reviewer, str) or not reviewer.strip():
            raise AlignmentError(f"decision[{index}] requires reviewer")
        if resolution != "merge_existing":
            continue
        item = items_by_id[alignment_id]
        candidate = candidates_by_id.get(item.get("candidateId"))
        target_id = decision.get("targetId")
        targets = place_targets if item.get("kind") == "place" else entity_targets
        target = targets.get(target_id)
        if not isinstance(candidate, dict) or not isinstance(target, dict):
            raise AlignmentError(f"decision[{index}] has invalid candidate or target")
        allowed_targets = {match.get("targetId") for match in item.get("matches", [])}
        if target_id not in allowed_targets:
            raise AlignmentError(f"decision[{index}] target was not suggested")
        source_payload = candidate.get("payload", {})
        if item.get("kind") == "entity":
            aliases = list(target.get("aliases", []))
            for name in _names(source_payload):
                if name != target.get("preferredName") and name not in aliases:
                    aliases.append(name)
            target["aliases"] = aliases
            source_id = source_payload.get("id") or candidate["id"].replace(
                "candidate-", "entity-"
            )
            reference_fields = {"entityId", "subjectId", "objectId"}
        else:
            historical_names = list(target.get("historicalNames", []))
            known_names = {
                item.get("name") for item in historical_names if isinstance(item, dict)
            }
            for source_name in source_payload.get("historicalNames", []):
                if not isinstance(source_name, dict):
                    continue
                name = source_name.get("name")
                if isinstance(name, str) and name not in known_names:
                    historical_names.append(copy.deepcopy(source_name))
                    known_names.add(name)
            target["historicalNames"] = historical_names
            source_id = source_payload.get("id") or candidate["id"].replace(
                "candidate-", "place-"
            )
            reference_fields = {"placeId"}
        for other in candidates:
            payload = other.get("payload") if isinstance(other, dict) else None
            if not isinstance(payload, dict):
                continue
            for field in reference_fields:
                if payload.get(field) == source_id:
                    payload[field] = target_id
        candidate["status"] = "rejected"
        history = candidate.setdefault("reviewHistory", [])
        history.append(
            {
                "status": "rejected",
                "reviewer": reviewer,
                "decidedAt": decision.get("decidedAt") or datetime.now(UTC).isoformat(),
                "note": decision.get("note") or f"已对齐并合入 {target_id}",
            }
        )
    if len(decided) != len(items):
        raise AlignmentError(
            f"alignment decisions are incomplete: {len(items) - len(decided)} remaining"
        )
    updated_publication = with_content_checksum(updated_publication)
    updated_candidates = {
        **candidate_batch,
        "baseContentChecksum": updated_publication["manifest"]["contentChecksum"],
        "candidates": candidates,
    }
    return updated_candidates, updated_publication
