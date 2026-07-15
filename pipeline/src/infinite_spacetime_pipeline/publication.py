"""Assemble and validate the portable knowledge publication."""

from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

CONTRACT_VERSION = "0.3.0"
COLLECTIONS = (
    "works",
    "editions",
    "volumes",
    "passages",
    "entities",
    "mentions",
    "assertions",
    "places",
    "geometries",
    "occurrences",
)
REVIEW_STATUSES = {
    "raw",
    "machine_suggested",
    "reviewed",
    "verified",
    "disputed",
    "rejected",
}


class PublicationValidationError(ValueError):
    """Raised when a publication breaks referential or evidence rules."""


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def assemble_publication(source_dir: Path) -> dict[str, Any]:
    """Combine manifest.json and collection JSON files into one publication."""

    manifest_path = source_dir / "manifest.json"
    if not manifest_path.exists():
        raise PublicationValidationError(f"Missing {manifest_path}")

    publication: dict[str, Any] = {"manifest": _load_json(manifest_path)}
    for collection in COLLECTIONS:
        path = source_dir / f"{collection}.json"
        publication[collection] = _load_json(path) if path.exists() else []
    validate_publication(publication)
    return publication


def write_publication(publication: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(publication, file, ensure_ascii=False, indent=2)
        file.write("\n")


def _ids(records: Iterable[dict[str, Any]], collection: str) -> set[str]:
    result: set[str] = set()
    for index, record in enumerate(records):
        identifier = record.get("id")
        if not isinstance(identifier, str) or not identifier:
            raise PublicationValidationError(
                f"{collection}[{index}] must contain a non-empty id"
            )
        if identifier in result:
            raise PublicationValidationError(
                f"Duplicate id in {collection}: {identifier}"
            )
        result.add(identifier)
    return result


def _validate_evidence_span(
    span: Any,
    owner: str,
    passages_by_id: dict[str, dict[str, Any]],
) -> None:
    if not isinstance(span, dict):
        raise PublicationValidationError(f"{owner} contains invalid evidence")
    passage_id = span.get("passageId")
    passage = passages_by_id.get(passage_id)
    if passage is None:
        raise PublicationValidationError(
            f"{owner} references missing evidence passage {passage_id}"
        )
    start, end = span.get("start"), span.get("end")
    original = passage["text"]["original"]
    if (
        not isinstance(start, int)
        or not isinstance(end, int)
        or start < 0
        or end <= start
        or end > len(original)
    ):
        raise PublicationValidationError(
            f"{owner} contains an invalid evidence character range"
        )


def _validate_temporal(value: Any, owner: str) -> None:
    if value is None:
        return
    if not isinstance(value, dict) or not isinstance(value.get("original"), str):
        raise PublicationValidationError(f"{owner} has an invalid temporal value")
    if value.get("certainty") not in {"exact", "approximate", "range", "unknown"}:
        raise PublicationValidationError(f"{owner} has an invalid temporal certainty")
    start, end = value.get("startYear"), value.get("endYear")
    if start is not None and not isinstance(start, int):
        raise PublicationValidationError(f"{owner} startYear must be an integer")
    if end is not None and not isinstance(end, int):
        raise PublicationValidationError(f"{owner} endYear must be an integer")
    if isinstance(start, int) and isinstance(end, int) and start > end:
        raise PublicationValidationError(f"{owner} startYear cannot exceed endYear")


def _validate_review_status(value: Any, owner: str, *, optional: bool = False) -> None:
    if optional and value is None:
        return
    if value not in REVIEW_STATUSES:
        raise PublicationValidationError(f"{owner} has an invalid reviewStatus")


def validate_publication(value: Any) -> None:
    """Validate contract version, unique ids, references and evidence invariants."""

    if not isinstance(value, dict):
        raise PublicationValidationError("Publication root must be an object")
    manifest = value.get("manifest")
    if not isinstance(manifest, dict):
        raise PublicationValidationError("manifest must be an object")
    if manifest.get("contractVersion") != CONTRACT_VERSION:
        raise PublicationValidationError(
            f"Expected contractVersion {CONTRACT_VERSION}"
        )

    for collection in COLLECTIONS:
        if not isinstance(value.get(collection), list):
            raise PublicationValidationError(f"{collection} must be an array")

    work_ids = _ids(value["works"], "works")
    edition_ids = _ids(value["editions"], "editions")
    volume_ids = _ids(value["volumes"], "volumes")
    passage_ids = _ids(value["passages"], "passages")
    entity_ids = _ids(value["entities"], "entities")
    _ids(value["mentions"], "mentions")
    _ids(value["assertions"], "assertions")
    place_ids = _ids(value["places"], "places")
    _ids(value["geometries"], "geometries")

    passages_by_id = {record["id"]: record for record in value["passages"]}
    editions_by_id = {record["id"]: record for record in value["editions"]}
    volumes_by_id = {record["id"]: record for record in value["volumes"]}

    for work in value["works"]:
        coverage = work.get("coverage")
        if coverage is not None:
            if not isinstance(coverage, dict):
                raise PublicationValidationError(
                    f"Work {work['id']} coverage must be an object"
                )
            _validate_temporal(coverage.get("temporal"), f"Work {work['id']}")
            if not isinstance(coverage.get("regionLabels"), list) or not isinstance(
                coverage.get("placeIds"), list
            ):
                raise PublicationValidationError(
                    f"Work {work['id']} coverage requires regionLabels and placeIds arrays"
                )
            for place_id in coverage["placeIds"]:
                if place_id not in place_ids:
                    raise PublicationValidationError(
                        f"Work {work['id']} coverage references missing place {place_id}"
                    )

    for edition in value["editions"]:
        if edition.get("workId") not in work_ids:
            raise PublicationValidationError(
                f"Edition {edition['id']} references missing work {edition.get('workId')}"
            )

    for volume in value["volumes"]:
        if volume.get("editionId") not in edition_ids:
            raise PublicationValidationError(
                f"Volume {volume['id']} references missing edition {volume.get('editionId')}"
            )
        parent = volume.get("parentVolumeId")
        if parent is not None and parent not in volume_ids:
            raise PublicationValidationError(
                f"Volume {volume['id']} references missing parent {parent}"
            )
        if parent is not None and volumes_by_id[parent].get("editionId") != volume.get(
            "editionId"
        ):
            raise PublicationValidationError(
                f"Volume {volume['id']} parent belongs to another edition"
            )

    for passage in value["passages"]:
        source = passage.get("source")
        text = passage.get("text")
        if not isinstance(source, dict) or not isinstance(text, dict):
            raise PublicationValidationError(
                f"Passage {passage['id']} requires source and text objects"
            )
        if source.get("passageId") != passage["id"]:
            raise PublicationValidationError(
                f"Passage {passage['id']} source.passageId must match its id"
            )
        if source.get("workId") not in work_ids:
            raise PublicationValidationError(
                f"Passage {passage['id']} references missing work"
            )
        if source.get("editionId") not in edition_ids:
            raise PublicationValidationError(
                f"Passage {passage['id']} references missing edition"
            )
        if source.get("volumeId") not in volume_ids:
            raise PublicationValidationError(
                f"Passage {passage['id']} references missing volume"
            )
        if editions_by_id[source["editionId"]].get("workId") != source.get("workId"):
            raise PublicationValidationError(
                f"Passage {passage['id']} edition belongs to another work"
            )
        if volumes_by_id[source["volumeId"]].get("editionId") != source.get(
            "editionId"
        ):
            raise PublicationValidationError(
                f"Passage {passage['id']} volume belongs to another edition"
            )
        if not isinstance(text.get("original"), str):
            raise PublicationValidationError(
                f"Passage {passage['id']} requires immutable text.original"
            )

    for mention in value["mentions"]:
        passage_id = mention.get("passageId")
        entity_id = mention.get("entityId")
        if passage_id not in passage_ids or entity_id not in entity_ids:
            raise PublicationValidationError(
                f"Mention {mention['id']} contains a missing reference"
            )
        passage_text = passages_by_id[passage_id]["text"]["original"]
        start, end = mention.get("start"), mention.get("end")
        if not isinstance(start, int) or not isinstance(end, int) or start < 0 or end <= start:
            raise PublicationValidationError(
                f"Mention {mention['id']} contains an invalid character range"
            )
        if end > len(passage_text):
            raise PublicationValidationError(
                f"Mention {mention['id']} exceeds immutable original text"
            )
        if passage_text[start:end] != mention.get("surface"):
            raise PublicationValidationError(
                f"Mention {mention['id']} does not match immutable original text"
            )
        confidence = mention.get("confidence")
        if confidence is not None and (
            not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1
        ):
            raise PublicationValidationError(
                f"Mention {mention['id']} confidence must be between 0 and 1"
            )
        _validate_review_status(
            mention.get("reviewStatus"), f"Mention {mention['id']}"
        )

    for assertion in value["assertions"]:
        _validate_review_status(
            assertion.get("reviewStatus"), f"Assertion {assertion['id']}"
        )
        _validate_temporal(
            assertion.get("temporal"), f"Assertion {assertion['id']}"
        )
        if assertion.get("subjectId") not in entity_ids:
            raise PublicationValidationError(
                f"Assertion {assertion['id']} references missing subject"
            )
        object_id = assertion.get("objectId")
        if object_id is not None and object_id not in entity_ids:
            raise PublicationValidationError(
                f"Assertion {assertion['id']} references missing object"
            )
        if object_id is None and assertion.get("literalValue") is None:
            raise PublicationValidationError(
                f"Assertion {assertion['id']} requires objectId or literalValue"
            )
        evidence = assertion.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            raise PublicationValidationError(
                f"Assertion {assertion['id']} requires evidence"
            )
        for span in evidence:
            _validate_evidence_span(
                span, f"Assertion {assertion['id']}", passages_by_id
            )

    for place in value["places"]:
        if place.get("entityId") not in entity_ids:
            raise PublicationValidationError(
                f"Place {place['id']} references missing entity"
            )
        for parent_id in place.get("parentPlaceIds", []):
            if parent_id not in place_ids:
                raise PublicationValidationError(
                    f"Place {place['id']} references missing parent {parent_id}"
                )

    for geometry in value["geometries"]:
        _validate_review_status(
            geometry.get("reviewStatus"), f"Geometry {geometry['id']}"
        )
        _validate_temporal(
            geometry.get("validDuring"), f"Geometry {geometry['id']}"
        )
        if geometry.get("placeId") not in place_ids:
            raise PublicationValidationError(
                f"Geometry {geometry['id']} references missing place"
            )
        shape = geometry.get("geometry")
        if not isinstance(shape, dict) or shape.get("type") not in {
            "Point",
            "Polygon",
        }:
            raise PublicationValidationError(
                f"Geometry {geometry['id']} has an unsupported shape"
            )
        if shape.get("type") == "Point":
            coordinates = shape.get("coordinates")
            if (
                not isinstance(coordinates, list)
                or len(coordinates) != 2
                or not all(isinstance(number, (int, float)) for number in coordinates)
                or not -180 <= coordinates[0] <= 180
                or not -90 <= coordinates[1] <= 90
            ):
                raise PublicationValidationError(
                    f"Geometry {geometry['id']} has invalid point coordinates"
                )

    _ids(value["occurrences"], "occurrences")
    for occurrence in value["occurrences"]:
        _validate_review_status(
            occurrence.get("reviewStatus"), f"Occurrence {occurrence['id']}"
        )
        _validate_temporal(
            occurrence.get("temporal"), f"Occurrence {occurrence['id']}"
        )
        if occurrence.get("entityId") not in entity_ids:
            raise PublicationValidationError(
                f"Occurrence {occurrence['id']} references missing entity"
            )
        if occurrence.get("placeId") not in place_ids:
            raise PublicationValidationError(
                f"Occurrence {occurrence['id']} references missing place"
            )
        evidence = occurrence.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            raise PublicationValidationError(
                f"Occurrence {occurrence['id']} requires evidence"
            )
        for span in evidence:
            _validate_evidence_span(
                span, f"Occurrence {occurrence['id']}", passages_by_id
            )

    for entity in value["entities"]:
        _validate_review_status(
            entity.get("reviewStatus"), f"Entity {entity['id']}", optional=True
        )
