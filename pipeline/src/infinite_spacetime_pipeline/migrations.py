"""Explicit, loss-aware migrations between published wire-contract versions."""

from __future__ import annotations

import hashlib
from copy import deepcopy
from typing import Any

from .contract_schema import contract_version, predicate_definitions
from .publication import validate_publication
from .publication_identity import with_content_checksum


class MigrationError(ValueError):
    """Raised when an old value cannot be migrated without inventing facts."""


LEGACY_PREDICATES = {
    "friend_of": "social.friend_of",
    "office": "office.held_title",
    "residedAt": "place.resided_at",
    "relatedTo": "other.related_to",
}


def _records(value: dict[str, Any], name: str) -> list[dict[str, Any]]:
    records = value.get(name)
    if not isinstance(records, list) or not all(
        isinstance(record, dict) for record in records
    ):
        raise MigrationError(f"0.3 publication.{name} must be an object array")
    return records


def _source_id(edition_id: str) -> str:
    digest = hashlib.sha256(edition_id.encode("utf-8")).hexdigest()[:16]
    return f"source-edition-{digest}"


def _page_id(volume_id: str, old_page_id: str) -> str:
    value = f"{volume_id}\0{old_page_id}".encode("utf-8")
    return f"facsimile-page-{hashlib.sha256(value).hexdigest()[:16]}"


def _single_provenance_source(
    source_ids: list[str], default_source_id: str | None, owner: str
) -> str:
    if default_source_id is not None:
        if default_source_id not in source_ids:
            raise MigrationError(
                f"{owner} requests unknown default source {default_source_id}"
            )
        return default_source_id
    if len(source_ids) == 1:
        return source_ids[0]
    raise MigrationError(
        f"{owner} has no source in 0.3; pass --default-source-id to make "
        "the curatorial attribution explicit"
    )


def migrate_0_3_to_0_4(
    value: dict[str, Any], *, default_source_id: str | None = None
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Migrate 0.3 data without silently dropping conflicting information."""

    if not isinstance(value, dict):
        raise MigrationError("0.3 publication must be an object")
    manifest = value.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("contractVersion") != "0.3.0":
        raise MigrationError("input manifest.contractVersion must be 0.3.0")

    works = deepcopy(_records(value, "works"))
    editions = deepcopy(_records(value, "editions"))
    volumes = deepcopy(_records(value, "volumes"))
    passages = deepcopy(_records(value, "passages"))
    entities = deepcopy(_records(value, "entities"))
    places = deepcopy(_records(value, "places"))
    geometries = deepcopy(_records(value, "geometries"))
    mentions = deepcopy(_records(value, "mentions"))
    assertions = deepcopy(_records(value, "assertions"))
    occurrences = deepcopy(_records(value, "occurrences"))

    report: dict[str, Any] = {
        "fromContractVersion": "0.3.0",
        "toContractVersion": "0.4.0",
        "createdSources": 0,
        "createdFacsimilePages": 0,
        "defaultedReviewStatuses": 0,
        "preservedPlaceNamesAsAliases": 0,
        "warnings": [],
    }

    facsimile_editions = {
        passage.get("source", {}).get("editionId")
        for passage in passages
        if isinstance(passage.get("facsimile"), dict)
    }
    sources: list[dict[str, Any]] = []
    source_by_edition: dict[str, str] = {}
    for edition in editions:
        rights = edition.pop("rightsStatement", None)
        if not isinstance(rights, str) or not rights.strip():
            raise MigrationError(
                f"Edition {edition.get('id')} has no rightsStatement; "
                "0.4 requires explicit source rights"
            )
        edition_id = edition["id"]
        source_id = _source_id(edition_id)
        source: dict[str, Any] = {
            "id": source_id,
            "kind": "facsimile" if edition_id in facsimile_editions else "other",
            "title": f"{edition['label']}来源",
            "rightsStatement": rights,
        }
        holding = edition.pop("holdingInstitution", None)
        url = edition.pop("sourceUrl", None)
        if holding:
            source["holdingInstitution"] = holding
        if url:
            source["url"] = url
        sources.append(source)
        source_by_edition[edition_id] = source_id
        edition["sourceRefs"] = [{"sourceId": source_id}]
    report["createdSources"] = len(sources)
    source_ids = [source["id"] for source in sources]

    editions_by_work: dict[str, list[str]] = {}
    for edition in editions:
        editions_by_work.setdefault(edition["workId"], []).append(
            source_by_edition[edition["id"]]
        )
    for work in works:
        work_sources = list(dict.fromkeys(editions_by_work.get(work["id"], [])))
        if not work_sources:
            raise MigrationError(
                f"Work {work['id']} has no edition source; 0.4 forbids "
                "provenance-free works"
            )
        coverage = work.get("coverage")
        described_region = work.pop("describedRegion", None)
        if described_region:
            if coverage is None:
                coverage = {"regionLabels": [], "placeIds": []}
                work["coverage"] = coverage
            labels = coverage["regionLabels"]
            if described_region not in labels:
                labels.append(described_region)
        work["sourceRefs"] = [
            {"sourceId": source_id} for source_id in work_sources
        ]

    volume_by_id = {volume["id"]: volume for volume in volumes}
    edition_by_id = {edition["id"]: edition for edition in editions}
    page_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    page_sequences: dict[str, int] = {}
    for passage in passages:
        old_source = passage.pop("source", None)
        if not isinstance(old_source, dict):
            raise MigrationError(f"Passage {passage.get('id')} has no 0.3 source")
        volume_id = old_source["volumeId"]
        volume = volume_by_id.get(volume_id)
        if volume is None:
            raise MigrationError(f"Passage {passage['id']} has unknown volume {volume_id}")
        if old_source["passageId"] != passage["id"]:
            raise MigrationError(f"Passage {passage['id']} has conflicting source.passageId")
        if old_source["editionId"] != volume["editionId"]:
            raise MigrationError(f"Passage {passage['id']} has conflicting editionId")
        edition = edition_by_id[volume["editionId"]]
        if old_source["workId"] != edition["workId"]:
            raise MigrationError(f"Passage {passage['id']} has conflicting workId")
        if old_source["volumeLabel"] != volume["label"]:
            raise MigrationError(f"Passage {passage['id']} has conflicting volumeLabel")
        passage["volumeId"] = volume_id
        section = old_source.get("sectionLabel")
        if section:
            passage["sectionLabel"] = section
        passage["facsimileAnchors"] = []
        facsimile = passage.pop("facsimile", None)
        if facsimile is None:
            continue
        if not facsimile.get("canvasUrl") and not facsimile.get("imageUrl"):
            raise MigrationError(
                f"Passage {passage['id']} facsimile has no usable image URL"
            )
        old_page_id = facsimile["pageId"]
        if old_source.get("pageId") not in (None, old_page_id):
            raise MigrationError(f"Passage {passage['id']} has conflicting pageId")
        key = (volume_id, old_page_id)
        page = page_by_key.get(key)
        if page is None:
            page = {
                "id": _page_id(volume_id, old_page_id),
                "volumeId": volume_id,
                "sourceId": source_by_edition[volume["editionId"]],
                "label": old_page_id,
                "sequence": page_sequences.get(volume_id, 0),
            }
            page_sequences[volume_id] = page["sequence"] + 1
            for field in ("canvasUrl", "imageUrl"):
                if facsimile.get(field):
                    page[field] = facsimile[field]
            page_by_key[key] = page
        elif any(
            facsimile.get(field) not in (None, page.get(field))
            for field in ("canvasUrl", "imageUrl")
        ):
            raise MigrationError(f"Facsimile {old_page_id} has conflicting URLs")
        anchor: dict[str, Any] = {"pageId": page["id"]}
        if facsimile.get("region") is not None:
            anchor["region"] = facsimile["region"]
        passage["facsimileAnchors"].append(anchor)

    for entity in entities:
        if "reviewStatus" not in entity:
            entity["reviewStatus"] = "raw"
            report["defaultedReviewStatuses"] += 1
    entity_by_id = {entity["id"]: entity for entity in entities}
    for place in places:
        old_name = place.pop("preferredName")
        entity = entity_by_id.get(place["entityId"])
        if entity is None:
            raise MigrationError(f"Place {place['id']} references a missing Entity")
        if old_name != entity["preferredName"] and old_name not in entity["aliases"]:
            entity["aliases"].append(old_name)
            report["preservedPlaceNamesAsAliases"] += 1
        for name in place["historicalNames"]:
            name["evidence"] = []
            name["sourceRefs"] = [
                {
                    "sourceId": _single_provenance_source(
                        source_ids, default_source_id, f"Place {place['id']} historical name"
                    )
                }
            ]
            report["warnings"].append(
                f"Historical name {name['name']} has source-level but no passage evidence"
            )
    for geometry in geometries:
        geometry["sourceRefs"] = [
            {
                "sourceId": _single_provenance_source(
                    source_ids, default_source_id, f"Geometry {geometry['id']}"
                )
            }
        ]

    next_manifest = {
        **manifest,
        "contractVersion": "0.4.0",
        "datasetVersion": "0.1.0-migrated.1",
        "contentChecksum": "sha256:" + ("0" * 64),
    }
    publication = with_content_checksum(
        {
            "manifest": next_manifest,
            "sources": sources,
            "works": works,
            "editions": editions,
            "volumes": volumes,
            "facsimilePages": list(page_by_key.values()),
            "passages": passages,
            "entities": entities,
            "mentions": mentions,
            "assertions": assertions,
            "places": places,
            "geometries": geometries,
            "occurrences": occurrences,
        }
    )
    report["createdFacsimilePages"] = len(page_by_key)
    report["contentChecksum"] = publication["manifest"]["contentChecksum"]
    return publication, report


def _next_dataset_version_for(value: str, contract: str) -> str:
    core = value.split("-", 1)[0]
    parts = core.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise MigrationError(f"Invalid datasetVersion for migration: {value}")
    major, minor, patch = (int(part) for part in parts)
    return f"{major}.{minor}.{patch + 1}-contract.{contract}"


def migrate_0_4_to_0_5(
    value: dict[str, Any],
    *,
    predicate_mapping: dict[str, str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Replace ungoverned predicate strings with the 0.5 core vocabulary."""

    if not isinstance(value, dict):
        raise MigrationError("0.4 publication must be an object")
    manifest = value.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("contractVersion") != "0.4.0":
        raise MigrationError("input manifest.contractVersion must be 0.4.0")
    publication = deepcopy(value)
    assertions = _records(publication, "assertions")
    mapping = {**LEGACY_PREDICATES, **(predicate_mapping or {})}
    allowed = predicate_definitions()
    unknown_targets = sorted(set(mapping.values()) - set(allowed))
    if unknown_targets:
        raise MigrationError(
            "predicate mapping contains unknown 0.5 targets: "
            + ", ".join(unknown_targets)
        )
    mapped: dict[str, int] = {}
    for assertion in assertions:
        old = assertion.get("predicate")
        if not isinstance(old, str):
            raise MigrationError(
                f"Assertion {assertion.get('id')} has no string predicate"
            )
        target = old if old in allowed else mapping.get(old)
        if target is None:
            raise MigrationError(
                f"Assertion {assertion.get('id')} uses unknown predicate {old}; "
                "provide an explicit predicate mapping"
            )
        assertion["predicate"] = target
        if target != old:
            key = f"{old} -> {target}"
            mapped[key] = mapped.get(key, 0) + 1
    next_manifest = publication["manifest"]
    next_manifest["contractVersion"] = "0.5.0"
    next_manifest["datasetVersion"] = _next_dataset_version_for(
        next_manifest["datasetVersion"], "0.5"
    )
    next_manifest["contentChecksum"] = "sha256:" + ("0" * 64)
    publication = with_content_checksum(publication)
    report = {
        "fromContractVersion": "0.4.0",
        "toContractVersion": "0.5.0",
        "mappedPredicates": mapped,
        "contentChecksum": publication["manifest"]["contentChecksum"],
    }
    return publication, report
def migrate_0_5_to_0_6(
    value: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Add the canonical curated passage-alignment collection."""

    if not isinstance(value, dict):
        raise MigrationError("0.5 publication must be an object")
    manifest = value.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("contractVersion") != "0.5.0":
        raise MigrationError("input manifest.contractVersion must be 0.5.0")
    if "passageAlignments" in value:
        raise MigrationError("0.5 publication unexpectedly contains passageAlignments")
    publication = deepcopy(value)
    publication["passageAlignments"] = []
    next_manifest = publication["manifest"]
    next_manifest["contractVersion"] = "0.6.0"
    next_manifest["datasetVersion"] = _next_dataset_version_for(
        next_manifest["datasetVersion"], "0.6"
    )
    next_manifest["contentChecksum"] = "sha256:" + ("0" * 64)
    publication = with_content_checksum(publication)
    validate_publication(publication)
    return publication, {
        "fromContractVersion": "0.5.0",
        "toContractVersion": "0.6.0",
        "createdPassageAlignments": 0,
        "contentChecksum": publication["manifest"]["contentChecksum"],
    }
def migrate_to_current(
    value: dict[str, Any],
    *,
    default_source_id: str | None = None,
    predicate_mapping: dict[str, str] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Apply every explicit migration required to reach the current contract."""

    version = value.get("manifest", {}).get("contractVersion")
    current = deepcopy(value)
    reports: list[dict[str, Any]] = []
    if version == "0.3.0":
        current, report = migrate_0_3_to_0_4(
            current, default_source_id=default_source_id
        )
        reports.append(report)
        version = "0.4.0"
    if version == "0.4.0":
        current, report = migrate_0_4_to_0_5(
            current, predicate_mapping=predicate_mapping
        )
        reports.append(report)
        version = "0.5.0"
    if version == "0.5.0":
        current, report = migrate_0_5_to_0_6(current)
        reports.append(report)
        version = "0.6.0"
    if version != contract_version():
        raise MigrationError(
            f"no migration path from {version!r} to {contract_version()}"
        )
    validate_publication(current)
    return current, reports
