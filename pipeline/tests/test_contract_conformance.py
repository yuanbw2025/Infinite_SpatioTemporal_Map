"""Keep Python contract acceptance identical to the TypeScript boundary."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from infinite_spacetime_pipeline.contract_schema import (
    ContractSchemaError,
    validate_contract_structure,
)


FIXTURES = (
    Path(__file__).resolve().parents[2] / "data" / "fixtures" / "contracts" / "0.4"
)


def _load(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


class ContractConformanceTest(unittest.TestCase):
    def test_language_neutral_golden_cases(self) -> None:
        for case in _load(FIXTURES / "cases.json"):
            with self.subTest(file=case["file"]):
                value = _load(FIXTURES / case["file"])
                if case["valid"]:
                    validate_contract_structure(value)
                else:
                    with self.assertRaises(ContractSchemaError):
                        validate_contract_structure(value)


if __name__ == "__main__":
    unittest.main()
