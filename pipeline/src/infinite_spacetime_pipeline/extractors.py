"""Evidence-first candidate extractors that never rewrite immutable source text."""

from __future__ import annotations

from typing import Any


class CandidateExtractionError(ValueError):
    """Raised when extractor inputs cannot produce auditable candidates."""


def _load_segments(segmentation: dict[str, Any]) -> list[dict[str, Any]]:
    raw_segments = segmentation.get("segments")
    if not isinstance(raw_segments, list):
        raise CandidateExtractionError("segmentation record has no segments list")
    segments: list[dict[str, Any]] = []
    for index, segment in enumerate(raw_segments):
        if not isinstance(segment, dict) or not isinstance(segment.get("id"), str):
            raise CandidateExtractionError(f"segments[{index}] requires id")
        text = segment.get("text")
        if not isinstance(text, dict) or not isinstance(text.get("original"), str):
            raise CandidateExtractionError(
                f"segments[{index}] requires immutable original text"
            )
        segments.append(segment)
    return segments


def _load_lexicon(lexicon: list[Any]) -> dict[str, list[str]]:
    by_surface: dict[str, list[str]] = {}
    for index, entry in enumerate(lexicon):
        if not isinstance(entry, dict) or not isinstance(entry.get("entityId"), str):
            raise CandidateExtractionError(f"lexicon[{index}] requires entityId")
        names = entry.get("names")
        if not isinstance(names, list) or not names or not all(
            isinstance(name, str) and name for name in names
        ):
            raise CandidateExtractionError(f"lexicon[{index}] requires names")
        for name in names:
            entity_ids = by_surface.setdefault(name, [])
            if entry["entityId"] not in entity_ids:
                entity_ids.append(entry["entityId"])
    return by_surface


def extract_mention_proposals(
    segmentation: dict[str, Any], lexicon: list[Any]
) -> list[dict[str, Any]]:
    """Find exact lexicon surfaces and emit original-text mention candidates."""

    segments = _load_segments(segmentation)
    by_surface = _load_lexicon(lexicon)
    surfaces = sorted(by_surface, key=lambda value: (-len(value), value))
    proposals: list[dict[str, Any]] = []
    for segment in segments:
        passage_id = segment["id"]
        original = segment["text"]["original"]
        occupied: set[int] = set()
        matches: list[tuple[int, int, str]] = []
        for surface in surfaces:
            cursor = 0
            while True:
                start = original.find(surface, cursor)
                if start < 0:
                    break
                end = start + len(surface)
                if not any(position in occupied for position in range(start, end)):
                    matches.append((start, end, surface))
                    occupied.update(range(start, end))
                cursor = start + 1
        for start, end, surface in sorted(matches):
            entity_ids = by_surface[surface]
            ambiguous = len(entity_ids) > 1
            for entity_id in entity_ids:
                evidence = [{"passageId": passage_id, "start": start, "end": end}]
                proposals.append(
                    {
                        "kind": "mention",
                        "payload": {
                            "passageId": passage_id,
                            "entityId": entity_id,
                            "start": start,
                            "end": end,
                            "surface": original[start:end],
                        },
                        "evidence": evidence,
                        "confidence": 0.5 if ambiguous else 1.0,
                        **(
                            {
                                "notes": (
                                    f"词面“{surface}”对应多个实体，必须人工消歧。"
                                )
                            }
                            if ambiguous
                            else {}
                        ),
                    }
                )
    return proposals
