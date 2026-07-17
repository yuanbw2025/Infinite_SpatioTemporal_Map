"""Stable machine candidates and append-only human review decisions."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

CANDIDATE_KINDS = {
    "entity",
    "mention",
    "assertion",
    "place",
    "geometry",
    "occurrence",
}
REVIEW_DECISIONS = {"reviewed", "verified", "disputed", "rejected"}
ALL_REVIEW_STATUSES = {"raw", "machine_suggested", *REVIEW_DECISIONS}
CANDIDATE_COLLECTIONS = {
    "entity": "entities",
    "mention": "mentions",
    "assertion": "assertions",
    "place": "places",
    "geometry": "geometries",
    "occurrence": "occurrences",
}


class CurationError(ValueError):
    """Raised when candidate provenance or a review transition is invalid."""


def _candidate_id(publication_id: str, proposal: dict[str, Any]) -> str:
    canonical = json.dumps(
        {
            "publicationId": publication_id,
            "kind": proposal.get("kind"),
            "payload": proposal.get("payload"),
            "evidence": proposal.get("evidence"),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return f"candidate-{hashlib.sha256(canonical.encode('utf-8')).hexdigest()[:20]}"


def create_candidate_batch(
    proposals: list[Any],
    *,
    publication_id: str,
    base_content_checksum: str,
    generator_id: str,
    generated_at: str | None = None,
) -> dict[str, Any]:
    if not publication_id.strip() or not generator_id.strip():
        raise CurationError("publication_id and generator_id are required")
    if not base_content_checksum.startswith("sha256:") or len(base_content_checksum) != 71:
        raise CurationError("base_content_checksum must be a sha256 checksum")
    candidates: list[dict[str, Any]] = []
    ids: set[str] = set()
    for index, proposal in enumerate(proposals):
        if not isinstance(proposal, dict):
            raise CurationError(f"proposal[{index}] must be an object")
        kind = proposal.get("kind")
        payload = proposal.get("payload")
        evidence = proposal.get("evidence")
        if kind not in CANDIDATE_KINDS:
            raise CurationError(f"proposal[{index}] has invalid kind")
        if not isinstance(payload, dict):
            raise CurationError(f"proposal[{index}] requires a payload object")
        if not isinstance(evidence, list) or not evidence:
            raise CurationError(f"proposal[{index}] requires evidence")
        for span in evidence:
            if (
                not isinstance(span, dict)
                or not isinstance(span.get("passageId"), str)
                or not isinstance(span.get("start"), int)
                or not isinstance(span.get("end"), int)
                or span["start"] < 0
                or span["end"] <= span["start"]
            ):
                raise CurationError(f"proposal[{index}] contains invalid evidence")
        confidence = proposal.get("confidence")
        if confidence is not None and (
            not isinstance(confidence, (int, float))
            or isinstance(confidence, bool)
            or not 0 <= confidence <= 1
        ):
            raise CurationError(f"proposal[{index}] confidence must be between 0 and 1")
        identifier = _candidate_id(publication_id, proposal)
        if identifier in ids:
            raise CurationError(f"duplicate candidate content at proposal[{index}]")
        ids.add(identifier)
        candidates.append(
            {
                "id": identifier,
                "kind": kind,
                "payload": payload,
                "evidence": evidence,
                "status": "machine_suggested",
                **({"confidence": confidence} if confidence is not None else {}),
                **({"notes": proposal["notes"]} if proposal.get("notes") else {}),
                "reviewHistory": [],
            }
        )
    return {
        "version": 1,
        "publicationId": publication_id,
        "baseContentChecksum": base_content_checksum,
        "generatorId": generator_id,
        "generatedAt": generated_at or datetime.now(UTC).isoformat(),
        "candidates": candidates,
    }


def apply_review_decisions(
    batch: dict[str, Any], decisions: list[Any]
) -> dict[str, Any]:
    raw_candidates = batch.get("candidates")
    if not isinstance(raw_candidates, list):
        raise CurationError("candidate batch has no candidates list")
    candidates: list[dict[str, Any]] = []
    candidates_by_id: dict[str, dict[str, Any]] = {}
    for candidate in raw_candidates:
        if not isinstance(candidate, dict) or not isinstance(candidate.get("id"), str):
            raise CurationError("candidate batch contains an invalid candidate")
        copied = {**candidate, "reviewHistory": list(candidate.get("reviewHistory", []))}
        if copied["id"] in candidates_by_id:
            raise CurationError(f"duplicate candidate id: {copied['id']}")
        candidates.append(copied)
        candidates_by_id[copied["id"]] = copied

    decided_ids: set[str] = set()
    for index, decision in enumerate(decisions):
        if not isinstance(decision, dict):
            raise CurationError(f"decision[{index}] must be an object")
        candidate_id = decision.get("candidateId")
        status = decision.get("status")
        reviewer = decision.get("reviewer")
        if not isinstance(candidate_id, str) or candidate_id not in candidates_by_id:
            raise CurationError(f"decision[{index}] references an unknown candidate")
        if candidate_id in decided_ids:
            raise CurationError(f"candidate {candidate_id} has multiple decisions in one batch")
        decided_ids.add(candidate_id)
        if status not in REVIEW_DECISIONS:
            raise CurationError(f"decision[{index}] has invalid status")
        if not isinstance(reviewer, str) or not reviewer.strip():
            raise CurationError(f"decision[{index}] requires reviewer")
        candidate = candidates_by_id[candidate_id]
        previous_status = candidate.get("status")
        if previous_status == "rejected":
            raise CurationError(f"rejected candidate {candidate_id} cannot be reopened silently")
        history = candidate["reviewHistory"]
        history.append(
            {
                "status": status,
                "reviewer": reviewer,
                "decidedAt": decision.get("decidedAt") or datetime.now(UTC).isoformat(),
                **({"note": decision["note"]} if decision.get("note") else {}),
                **(
                    {"correctedPayload": decision["correctedPayload"]}
                    if isinstance(decision.get("correctedPayload"), dict)
                    else {}
                ),
            }
        )
        candidate["status"] = status
        if isinstance(decision.get("correctedPayload"), dict):
            candidate["payload"] = decision["correctedPayload"]
    return {**batch, "candidates": candidates}


def candidate_review_summary(batch: dict[str, Any]) -> dict[str, int]:
    candidates = batch.get("candidates")
    if not isinstance(candidates, list):
        raise CurationError("candidate batch has no candidates list")
    counts: dict[str, int] = {}
    for candidate in candidates:
        if not isinstance(candidate, dict):
            raise CurationError("candidate batch contains an invalid candidate")
        status = candidate.get("status")
        if status not in ALL_REVIEW_STATUSES:
            raise CurationError("candidate has an invalid status")
        counts[status] = counts.get(status, 0) + 1
    return counts


def promote_reviewed_candidates(batch: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Materialize reviewed candidate payloads as publication collection shards."""

    candidates = batch.get("candidates")
    if not isinstance(candidates, list):
        raise CurationError("candidate batch has no candidates list")
    collections: dict[str, list[dict[str, Any]]] = {
        collection: [] for collection in CANDIDATE_COLLECTIONS.values()
    }
    ids_by_collection: dict[str, set[str]] = {
        collection: set() for collection in CANDIDATE_COLLECTIONS.values()
    }
    pending: list[str] = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            raise CurationError("candidate batch contains an invalid candidate")
        candidate_id = candidate.get("id")
        kind = candidate.get("kind")
        status = candidate.get("status")
        if not isinstance(candidate_id, str) or kind not in CANDIDATE_COLLECTIONS:
            raise CurationError("candidate has an invalid id or kind")
        if status in {"raw", "machine_suggested"}:
            pending.append(candidate_id)
            continue
        if status == "rejected":
            continue
        if status not in {"reviewed", "verified", "disputed"}:
            raise CurationError(f"candidate {candidate_id} has invalid status")
        payload = candidate.get("payload")
        if not isinstance(payload, dict):
            raise CurationError(f"candidate {candidate_id} has no payload")
        collection = CANDIDATE_COLLECTIONS[kind]
        record_id = payload.get("id") or candidate_id.replace("candidate-", f"{kind}-")
        if not isinstance(record_id, str) or not record_id:
            raise CurationError(f"candidate {candidate_id} has an invalid record id")
        if record_id in ids_by_collection[collection]:
            raise CurationError(f"duplicate promoted id in {collection}: {record_id}")
        ids_by_collection[collection].add(record_id)
        record = {**payload, "id": record_id}
        if kind in {"entity", "mention", "assertion", "geometry", "occurrence"}:
            record["reviewStatus"] = status
        if kind in {"assertion", "occurrence"} and "evidence" not in record:
            record["evidence"] = candidate.get("evidence", [])
        collections[collection].append(record)
    if pending:
        raise CurationError(
            f"cannot promote {len(pending)} pending candidates: {', '.join(pending[:5])}"
        )
    return collections
