"""Collision-safe, fully validated, atomic candidate publication."""

from __future__ import annotations

import os
from copy import deepcopy
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from .curation import CurationError, promote_reviewed_candidates
from .publication import validate_publication, write_publication


def merge_reviewed_candidates(
    publication: dict[str, Any], candidate_batch: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, int]]:
    """Merge reviewed records without overwriting any canonical record."""

    validate_publication(publication)
    publication_id = publication["manifest"]["publicationId"]
    if candidate_batch.get("publicationId") != publication_id:
        raise CurationError(
            "candidate batch and publication have different publicationId values"
        )
    if (
        candidate_batch.get("baseContentChecksum")
        != publication["manifest"]["contentChecksum"]
    ):
        raise CurationError(
            "candidate batch was extracted from a different publication checksum"
        )
    promoted = promote_reviewed_candidates(candidate_batch)
    output = deepcopy(publication)
    global_ids = {
        record["id"]
        for name, records in output.items()
        if name != "manifest" and isinstance(records, list)
        for record in records
        if isinstance(record, dict) and isinstance(record.get("id"), str)
    }
    counts: dict[str, int] = {}
    for collection, records in promoted.items():
        target = output.get(collection)
        if not isinstance(target, list):
            raise CurationError(f"publication has no {collection} collection")
        for record in records:
            if record["id"] in global_ids:
                raise CurationError(
                    f"promoted id already exists in publication: {record['id']}"
                )
            global_ids.add(record["id"])
            target.append(record)
        counts[collection] = len(records)
    return output, counts


def promote_candidates_atomically(
    publication: dict[str, Any],
    candidate_batch: dict[str, Any],
    output_path: Path,
) -> dict[str, Any]:
    """Validate a staged full publication before one atomic filesystem replace."""

    merged, counts = merge_reviewed_candidates(publication, candidate_batch)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with NamedTemporaryFile(
            mode="w",
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            dir=output_path.parent,
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
        write_publication(merged, temporary_path)
        os.replace(temporary_path, output_path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return {
        "publicationId": publication["manifest"]["publicationId"],
        "output": str(output_path),
        "promotedCounts": counts,
    }
