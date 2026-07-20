"""Formal-release gate layered on top of portable publication validation."""

from __future__ import annotations

from typing import Any

from .curation import CurationError, candidate_review_summary
from .publication import PublicationValidationError, validate_publication

CURATED_COLLECTIONS = (
    "sourceRelations",
    "mentions",
    "assertions",
    "geometries",
    "occurrences",
)


def evaluate_release_gate(
    publication: dict[str, Any],
    *,
    source_report: dict[str, Any] | None = None,
    candidate_batch: dict[str, Any] | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        validate_publication(publication)
    except PublicationValidationError as error:
        errors.append(str(error))

    manifest = publication.get("manifest")
    publication_id = manifest.get("publicationId") if isinstance(manifest, dict) else None
    if not isinstance(manifest, dict) or not str(
        manifest.get("sourceDescription", "")
    ).strip():
        errors.append("publication manifest requires sourceDescription")

    sources = publication.get("sources")
    if isinstance(sources, list):
        for source in sources:
            if isinstance(source, dict) and not str(
                source.get("rightsStatement", "")
            ).strip():
                errors.append(
                    f"source {source.get('id', '<unknown>')} requires rightsStatement"
                )

    for collection in CURATED_COLLECTIONS:
        records = publication.get(collection)
        if not isinstance(records, list):
            continue
        for record in records:
            if not isinstance(record, dict):
                continue
            status = record.get("reviewStatus")
            if status in {"raw", "machine_suggested"}:
                errors.append(
                    f"{collection} {record.get('id', '<unknown>')} is not human-reviewed"
                )
            elif status == "disputed":
                warnings.append(
                    f"{collection} {record.get('id', '<unknown>')} remains disputed"
                )

    if source_report is None:
        errors.append("source manifest verification report was not supplied")
    else:
        if source_report.get("publicationId") != publication_id:
            errors.append("source manifest belongs to another publication")
        if not source_report.get("passed"):
            errors.extend(
                f"source gate: {message}" for message in source_report.get("errors", [])
            )
        warnings.extend(
            f"source gate: {message}" for message in source_report.get("warnings", [])
        )

    review_counts: dict[str, int] = {}
    if candidate_batch is not None:
        if candidate_batch.get("publicationId") != publication_id:
            errors.append("candidate batch belongs to another publication")
        try:
            review_counts = candidate_review_summary(candidate_batch)
        except CurationError as error:
            errors.append(str(error))
        pending = review_counts.get("raw", 0) + review_counts.get(
            "machine_suggested", 0
        )
        if pending:
            errors.append(f"candidate review queue still has {pending} pending items")
        if review_counts.get("disputed", 0):
            warnings.append(
                f"candidate review queue has {review_counts['disputed']} disputed items"
            )
    else:
        errors.append("candidate review batch was not supplied")

    return {
        "publicationId": publication_id,
        "contentChecksum": (
            manifest.get("contentChecksum") if isinstance(manifest, dict) else None
        ),
        "passed": not errors,
        "errors": errors,
        "warnings": warnings,
        "reviewCounts": review_counts,
    }
