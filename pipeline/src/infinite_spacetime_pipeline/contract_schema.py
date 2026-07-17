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
