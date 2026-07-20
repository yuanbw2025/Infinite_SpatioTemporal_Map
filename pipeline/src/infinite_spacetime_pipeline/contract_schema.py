"""Load and execute the canonical JSON Schema used by every language boundary."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


class ContractSchemaError(ValueError):
    """Raised when a value does not conform to the canonical wire contract."""


def contract_schema_path() -> Path:
    """Return the monorepo's sole canonical publication Schema path."""

    repository_root = Path(__file__).resolve().parents[3]
    return repository_root / "packages/contracts/schemas/publication.schema.json"


def predicate_vocabulary_path() -> Path:
    repository_root = Path(__file__).resolve().parents[3]
    return repository_root / "packages/contracts/vocabularies/predicates.json"


@lru_cache(maxsize=1)
def publication_schema() -> dict[str, Any]:
    path = contract_schema_path()
    try:
        with path.open("r", encoding="utf-8") as file:
            schema = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        raise ContractSchemaError(f"Cannot load canonical Schema at {path}: {error}") from error
    if not isinstance(schema, dict):
        raise ContractSchemaError(f"Canonical Schema at {path} is not an object")
    Draft202012Validator.check_schema(schema)
    return schema


@lru_cache(maxsize=1)
def predicate_definitions() -> dict[str, dict[str, Any]]:
    path = predicate_vocabulary_path()
    try:
        with path.open("r", encoding="utf-8") as file:
            value = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        raise ContractSchemaError(
            f"Cannot load predicate vocabulary at {path}: {error}"
        ) from error
    records = value.get("definitions") if isinstance(value, dict) else None
    if not isinstance(records, list) or not all(
        isinstance(record, dict) and isinstance(record.get("id"), str)
        for record in records
    ):
        raise ContractSchemaError("Predicate vocabulary definitions are malformed")
    definitions = {record["id"]: record for record in records}
    if len(definitions) != len(records):
        raise ContractSchemaError("Predicate vocabulary contains duplicate IDs")
    schema_ids = publication_schema().get("definitions", {}).get(
        "PredicateId", {}
    ).get("enum")
    if list(definitions) != schema_ids:
        raise ContractSchemaError(
            "Predicate vocabulary IDs do not match the canonical Schema"
        )
    for identifier, definition in definitions.items():
        inverse = definition.get("inversePredicateId")
        if inverse is not None:
            target = definitions.get(inverse)
            if target is None or target.get("inversePredicateId") != identifier:
                raise ContractSchemaError(
                    f"Predicate {identifier} has a non-reciprocal inverse"
                )
        if definition.get("valueKind") == "literal" and definition.get("objectTypes"):
            raise ContractSchemaError(
                f"Literal predicate {identifier} cannot constrain object types"
            )
    return definitions


def contract_version() -> str:
    try:
        value = publication_schema()["definitions"]["PublicationManifest"][
            "properties"
        ]["contractVersion"]["const"]
    except (KeyError, TypeError) as error:
        raise ContractSchemaError("Canonical Schema has no contract version const") from error
    if not isinstance(value, str):
        raise ContractSchemaError("Canonical Schema contract version must be a string")
    return value


def publication_collections() -> tuple[str, ...]:
    properties = publication_schema().get("properties", {})
    if not isinstance(properties, dict):
        raise ContractSchemaError("Canonical Schema has no root properties")
    return tuple(name for name in properties if name != "manifest")


@lru_cache(maxsize=1)
def publication_validator() -> Draft202012Validator:
    return Draft202012Validator(
        publication_schema(),
        format_checker=FormatChecker(),
    )


def validate_contract_structure(value: Any) -> None:
    """Validate JSON structure and report the first deterministic error."""

    errors = sorted(
        publication_validator().iter_errors(value),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    if not errors:
        return
    error = errors[0]
    location = "$"
    for part in error.absolute_path:
        location += f"[{part}]" if isinstance(part, int) else f".{part}"
    raise ContractSchemaError(f"{location}: {error.message}")
