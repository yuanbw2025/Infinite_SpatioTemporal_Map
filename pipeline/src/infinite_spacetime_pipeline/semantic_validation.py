"""Cross-record and historical semantics beyond structural JSON Schema checks."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from .contract_schema import predicate_definitions
from .publication_identity import calculate_content_checksum


class SemanticValidationError(ValueError):
    """Raised when structurally valid data violates domain invariants."""


def _ids(
    records: Iterable[dict[str, Any]],
    collection: str,
    global_ids: dict[str, str],
) -> set[str]:
    result: set[str] = set()
    for record in records:
        identifier = record["id"]
        if identifier in result:
            raise SemanticValidationError(f"Duplicate id in {collection}: {identifier}")
        previous = global_ids.get(identifier)
        if previous is not None:
            raise SemanticValidationError(
                f"ID {identifier} is reused by {previous} and {collection}"
            )
        result.add(identifier)
        global_ids[identifier] = collection
    return result


def _temporal(value: dict[str, Any] | None, owner: str) -> None:
    if value is None:
        return
    for prefix in ("start", "end"):
        month = value.get(f"{prefix}Month")
        day = value.get(f"{prefix}Day")
        if day is not None and month is None:
            raise SemanticValidationError(f"{owner} {prefix}Day requires {prefix}Month")
        if month is not None and value.get(f"{prefix}Year") is None:
            raise SemanticValidationError(f"{owner} {prefix}Month requires {prefix}Year")
    start_year = value.get("startYear")
    end_year = value.get("endYear")
    if start_year is None or end_year is None:
        return
    start = (start_year, value.get("startMonth", 1), value.get("startDay", 1))
    end = (end_year, value.get("endMonth", 12), value.get("endDay", 31))
    if start > end:
        raise SemanticValidationError(f"{owner} start date cannot exceed end date")


def _evidence(
    spans: Iterable[dict[str, Any]],
    owner: str,
    passages: dict[str, dict[str, Any]],
) -> None:
    for span in spans:
        passage = passages.get(span["passageId"])
        if passage is None:
            raise SemanticValidationError(
                f"{owner} references missing passage {span['passageId']}"
            )
        start, end = span["start"], span["end"]
        original = passage["text"]["original"]
        if end <= start or end > len(original):
            raise SemanticValidationError(f"{owner} has an invalid evidence range")


def _source_refs(
    refs: Iterable[dict[str, Any]], owner: str, source_ids: set[str]
) -> None:
    for ref in refs:
        if ref["sourceId"] not in source_ids:
            raise SemanticValidationError(
                f"{owner} references missing source {ref['sourceId']}"
            )


def _position(value: list[Any]) -> bool:
    return (
        len(value) == 2
        and all(isinstance(item, (int, float)) and not isinstance(item, bool) for item in value)
        and -180 <= value[0] <= 180
        and -90 <= value[1] <= 90
    )


def _geometry(shape: dict[str, Any], owner: str) -> None:
    shape_type = shape["type"]
    coordinates = shape["coordinates"]
    polygons = [coordinates] if shape_type == "Polygon" else coordinates
    if shape_type == "Point":
        if not _position(coordinates):
            raise SemanticValidationError(f"{owner} has invalid point coordinates")
        return
    for polygon in polygons:
        for ring in polygon:
            if not all(_position(position) for position in ring):
                raise SemanticValidationError(f"{owner} has invalid coordinates")
            if ring[0] != ring[-1]:
                raise SemanticValidationError(f"{owner} contains an open linear ring")


def _acyclic(parents: dict[str, tuple[str, ...]], label: str) -> None:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(identifier: str) -> None:
        if identifier in visiting:
            raise SemanticValidationError(f"{label} hierarchy contains a cycle at {identifier}")
        if identifier in visited:
            return
        visiting.add(identifier)
        for parent in parents.get(identifier, ()):
            visit(parent)
        visiting.remove(identifier)
        visited.add(identifier)

    for identifier in parents:
        visit(identifier)


def _unique_sequences(
    records: Iterable[dict[str, Any]], group_fields: tuple[str, ...], owner: str
) -> None:
    seen: set[tuple[Any, ...]] = set()
    for record in records:
        key = (*[record.get(field) for field in group_fields], record["sequence"])
        if key in seen:
            raise SemanticValidationError(f"{owner} contains a duplicate sequence {key}")
        seen.add(key)


class _PublicationSemantics:
    def __init__(self, value: dict[str, Any]) -> None:
        self.value = value
        global_ids: dict[str, str] = {}
        self.ids = {
            name: _ids(value[name], name, global_ids)
            for name in (
                "sources",
                "works",
                "editions",
                "volumes",
                "facsimilePages",
                "passages",
                "passageAlignments",
                "entities",
                "mentions",
                "assertions",
                "places",
                "geometries",
                "occurrences",
            )
        }
        self.sources = self.ids["sources"]
        self.entities = {item["id"]: item for item in value["entities"]}
        self.predicates = predicate_definitions()
        self.passages = {item["id"]: item for item in value["passages"]}
        self.volumes = {item["id"]: item for item in value["volumes"]}
        self.editions = {item["id"]: item for item in value["editions"]}
        self.pages = {item["id"]: item for item in value["facsimilePages"]}

    def validate(self) -> None:
        self._manifest()
        self._catalog()
        self._text()
        self._knowledge()
        self._spacetime()

    def _manifest(self) -> None:
        expected = calculate_content_checksum(self.value)
        if self.value["manifest"]["contentChecksum"] != expected:
            raise SemanticValidationError("manifest.contentChecksum does not match content")

    def _catalog(self) -> None:
        place_ids = self.ids["places"]
        for work in self.value["works"]:
            if work["title"] in work["alternativeTitles"]:
                raise SemanticValidationError(f"Work {work['id']} repeats its title as an alternative")
            _source_refs(work["sourceRefs"], f"Work {work['id']}", self.sources)
            coverage = work.get("coverage")
            if coverage:
                _temporal(coverage.get("temporal"), f"Work {work['id']}")
                if not set(coverage["placeIds"]).issubset(place_ids):
                    raise SemanticValidationError(f"Work {work['id']} references a missing place")
        for edition in self.value["editions"]:
            if edition["workId"] not in self.ids["works"]:
                raise SemanticValidationError(f"Edition {edition['id']} references a missing work")
            _source_refs(edition["sourceRefs"], f"Edition {edition['id']}", self.sources)
        volume_parents: dict[str, tuple[str, ...]] = {}
        for volume in self.value["volumes"]:
            if volume["editionId"] not in self.ids["editions"]:
                raise SemanticValidationError(f"Volume {volume['id']} references a missing edition")
            parent = volume.get("parentVolumeId")
            volume_parents[volume["id"]] = (parent,) if parent else ()
            if parent and parent not in self.volumes:
                raise SemanticValidationError(f"Volume {volume['id']} references a missing parent")
            if parent and self.volumes[parent]["editionId"] != volume["editionId"]:
                raise SemanticValidationError(f"Volume {volume['id']} parent has another edition")
        _acyclic(volume_parents, "Volume")
        _unique_sequences(self.value["volumes"], ("editionId", "parentVolumeId"), "Volumes")

    def _text(self) -> None:
        for page in self.value["facsimilePages"]:
            if page["volumeId"] not in self.ids["volumes"] or page["sourceId"] not in self.sources:
                raise SemanticValidationError(f"FacsimilePage {page['id']} has a missing reference")
            if not page.get("canvasUrl") and not page.get("imageUrl"):
                raise SemanticValidationError(f"FacsimilePage {page['id']} requires a URL")
            if (page.get("width") is None) != (page.get("height") is None):
                raise SemanticValidationError(f"FacsimilePage {page['id']} requires width and height together")
        _unique_sequences(self.value["facsimilePages"], ("volumeId",), "Facsimile pages")
        for passage in self.value["passages"]:
            if passage["volumeId"] not in self.volumes:
                raise SemanticValidationError(f"Passage {passage['id']} references a missing volume")
            for anchor in passage["facsimileAnchors"]:
                page = self.pages.get(anchor["pageId"])
                if page is None or page["volumeId"] != passage["volumeId"]:
                    raise SemanticValidationError(f"Passage {passage['id']} has an invalid facsimile anchor")
        _unique_sequences(self.value["passages"], ("volumeId",), "Passages")
        occupied: set[tuple[tuple[str, ...], str]] = set()
        for alignment in self.value["passageAlignments"]:
            if alignment["workId"] not in self.ids["works"]:
                raise SemanticValidationError(
                    f"PassageAlignment {alignment['id']} references a missing work"
                )
            edition_ids = [member["editionId"] for member in alignment["members"]]
            if len(set(edition_ids)) != len(edition_ids):
                raise SemanticValidationError(
                    f"PassageAlignment {alignment['id']} repeats an edition"
                )
            edition_key = tuple(sorted(edition_ids))
            for member in alignment["members"]:
                edition = self.editions.get(member["editionId"])
                if edition is None or edition["workId"] != alignment["workId"]:
                    raise SemanticValidationError(
                        f"PassageAlignment {alignment['id']} has an invalid edition"
                    )
                for passage_id in member["passageIds"]:
                    passage = self.passages.get(passage_id)
                    if (
                        passage is None
                        or self.volumes[passage["volumeId"]]["editionId"]
                        != member["editionId"]
                    ):
                        raise SemanticValidationError(
                            f"PassageAlignment {alignment['id']} has an invalid passage"
                        )
                    occupied_key = (edition_key, passage_id)
                    if occupied_key in occupied:
                        raise SemanticValidationError(
                            f"Passage {passage_id} is duplicated for the same edition set"
                        )
                    occupied.add(occupied_key)

    def _knowledge(self) -> None:
        for entity in self.value["entities"]:
            if entity["preferredName"] in entity["aliases"]:
                raise SemanticValidationError(f"Entity {entity['id']} repeats its preferred name")
        for mention in self.value["mentions"]:
            passage = self.passages.get(mention["passageId"])
            if passage is None or mention["entityId"] not in self.entities:
                raise SemanticValidationError(f"Mention {mention['id']} has a missing reference")
            original = passage["text"]["original"]
            if mention["end"] <= mention["start"] or original[mention["start"] : mention["end"]] != mention["surface"]:
                raise SemanticValidationError(f"Mention {mention['id']} does not match immutable original text")
        for assertion in self.value["assertions"]:
            subject = self.entities.get(assertion["subjectId"])
            if subject is None:
                raise SemanticValidationError(f"Assertion {assertion['id']} has a missing subject")
            definition = self.predicates[assertion["predicate"]]
            subject_types = definition["subjectTypes"]
            if subject_types and subject["type"] not in subject_types:
                raise SemanticValidationError(
                    f"Assertion {assertion['id']} predicate does not accept "
                    f"subject type {subject['type']}"
                )
            if "objectId" in assertion:
                related = self.entities.get(assertion["objectId"])
                if related is None:
                    raise SemanticValidationError(
                        f"Assertion {assertion['id']} has a missing object"
                    )
                if definition["valueKind"] != "entity":
                    raise SemanticValidationError(
                        f"Assertion {assertion['id']} predicate requires a literal value"
                    )
                object_types = definition["objectTypes"]
                if object_types and related["type"] not in object_types:
                    raise SemanticValidationError(
                        f"Assertion {assertion['id']} predicate does not accept "
                        f"object type {related['type']}"
                    )
            elif definition["valueKind"] != "literal":
                raise SemanticValidationError(
                    f"Assertion {assertion['id']} predicate requires an entity object"
                )
            _temporal(assertion.get("temporal"), f"Assertion {assertion['id']}")
            _evidence(assertion["evidence"], f"Assertion {assertion['id']}", self.passages)

    def _spacetime(self) -> None:
        place_parents: dict[str, tuple[str, ...]] = {}
        for place in self.value["places"]:
            entity = self.entities.get(place["entityId"])
            if entity is None or entity["type"] != "place":
                raise SemanticValidationError(f"Place {place['id']} requires a place Entity")
            if not set(place["parentPlaceIds"]).issubset(self.ids["places"]):
                raise SemanticValidationError(f"Place {place['id']} references a missing parent")
            place_parents[place["id"]] = tuple(place["parentPlaceIds"])
            for name in place["historicalNames"]:
                if not name["evidence"] and not name["sourceRefs"]:
                    raise SemanticValidationError(f"Place {place['id']} historical name lacks provenance")
                _temporal(name.get("validDuring"), f"Place {place['id']} historical name")
                _evidence(name["evidence"], f"Place {place['id']} historical name", self.passages)
                _source_refs(name["sourceRefs"], f"Place {place['id']} historical name", self.sources)
        _acyclic(place_parents, "Place")
        for geometry in self.value["geometries"]:
            if geometry["placeId"] not in self.ids["places"]:
                raise SemanticValidationError(f"Geometry {geometry['id']} references a missing place")
            _temporal(geometry.get("validDuring"), f"Geometry {geometry['id']}")
            _source_refs(geometry["sourceRefs"], f"Geometry {geometry['id']}", self.sources)
            _geometry(geometry["geometry"], f"Geometry {geometry['id']}")
        for occurrence in self.value["occurrences"]:
            if occurrence["entityId"] not in self.entities or occurrence["placeId"] not in self.ids["places"]:
                raise SemanticValidationError(f"Occurrence {occurrence['id']} has a missing reference")
            _temporal(occurrence.get("temporal"), f"Occurrence {occurrence['id']}")
            _evidence(occurrence["evidence"], f"Occurrence {occurrence['id']}", self.passages)


def validate_publication_semantics(value: dict[str, Any]) -> None:
    _PublicationSemantics(value).validate()
