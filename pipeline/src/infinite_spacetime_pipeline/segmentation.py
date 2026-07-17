"""Stable, lossless segmentation and independently auditable text layers."""

from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass
from typing import Any, Callable, Iterable


class SegmentationError(ValueError):
    """Raised when staging data would lose or overwrite source text."""


@dataclass(frozen=True, slots=True)
class TextSegment:
    id: str
    sequence: int
    start: int
    end: int
    text: dict[str, str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class SegmentationResult:
    publication_id: str
    source_key: str
    source_sha256: str
    segments: tuple[TextSegment, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "publicationId": self.publication_id,
            "sourceKey": self.source_key,
            "sourceSha256": self.source_sha256,
            "segments": [segment.to_dict() for segment in self.segments],
        }


def _units(text: str) -> Iterable[tuple[int, int]]:
    """Yield paragraph-like spans while retaining every original character."""

    start = 0
    for match in re.finditer(r"\n[ \t]*\n+", text):
        end = match.end()
        yield start, end
        start = end
    if start < len(text):
        yield start, len(text)


def _split_long_span(text: str, start: int, end: int, maximum: int) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    cursor = start
    break_characters = "。！？；\n.!?;"
    while end - cursor > maximum:
        window_end = cursor + maximum
        minimum_break = cursor + max(maximum // 2, 1)
        break_at = max(
            (text.rfind(character, minimum_break, window_end) for character in break_characters),
            default=-1,
        )
        split_at = break_at + 1 if break_at >= minimum_break else window_end
        spans.append((cursor, split_at))
        cursor = split_at
    if cursor < end:
        spans.append((cursor, end))
    return spans


def _stable_id(
    publication_id: str,
    source_key: str,
    original: str,
    duplicate_index: int,
) -> str:
    digest = hashlib.sha256(
        f"{publication_id}\0{source_key}\0{original}\0{duplicate_index}".encode("utf-8")
    ).hexdigest()[:20]
    return f"passage-{digest}"


def segment_text(
    *,
    publication_id: str,
    source_key: str,
    source_sha256: str,
    text: str,
    max_chars: int = 2000,
) -> SegmentationResult:
    """Split source text without rewriting it and assign content-stable passage IDs."""

    if not publication_id.strip() or not source_key.strip():
        raise SegmentationError("publication_id and source_key are required")
    if max_chars < 128:
        raise SegmentationError("max_chars must be at least 128")
    if not text:
        raise SegmentationError("source text is empty; OCR or extraction must finish first")

    spans: list[tuple[int, int]] = []
    for start, end in _units(text):
        spans.extend(_split_long_span(text, start, end, max_chars))
    if not spans or "".join(text[start:end] for start, end in spans) != text:
        raise SegmentationError("segmentation did not preserve the source text exactly")

    duplicate_counts: dict[str, int] = {}
    segments: list[TextSegment] = []
    for sequence, (start, end) in enumerate(spans, start=1):
        original = text[start:end]
        duplicate_index = duplicate_counts.get(original, 0)
        duplicate_counts[original] = duplicate_index + 1
        segments.append(
            TextSegment(
                id=_stable_id(publication_id, source_key, original, duplicate_index),
                sequence=sequence,
                start=start,
                end=end,
                text={"original": original},
            )
        )
    return SegmentationResult(
        publication_id=publication_id,
        source_key=source_key,
        source_sha256=source_sha256,
        segments=tuple(segments),
    )


def add_text_layer(
    segmentation: dict[str, Any],
    *,
    layer: str,
    values: dict[str, str],
    transform: Callable[[str], str] | None = None,
) -> dict[str, Any]:
    """Attach a derived reading layer without touching the original."""

    if layer not in {"simplified", "punctuated", "modernTranslation"}:
        raise SegmentationError(
            "layer must be simplified, punctuated, or modernTranslation"
        )
    segments = segmentation.get("segments")
    if not isinstance(segments, list):
        raise SegmentationError("segmentation record has no segments list")

    output = {**segmentation, "segments": []}
    known_ids: set[str] = set()
    for raw_segment in segments:
        if not isinstance(raw_segment, dict) or not isinstance(raw_segment.get("id"), str):
            raise SegmentationError("each segment must have an id")
        segment_id = raw_segment["id"]
        known_ids.add(segment_id)
        raw_text = raw_segment.get("text")
        if not isinstance(raw_text, dict) or not isinstance(raw_text.get("original"), str):
            raise SegmentationError(f"segment {segment_id} has no immutable original text")
        value = values.get(segment_id)
        if value is None and transform is not None:
            value = transform(raw_text["original"])
        if value is None:
            raise SegmentationError(f"missing {layer} text for segment {segment_id}")
        output["segments"].append(
            {**raw_segment, "text": {**raw_text, layer: value}}
        )

    unknown_ids = set(values) - known_ids
    if unknown_ids:
        raise SegmentationError(
            f"text layer contains unknown segment ids: {', '.join(sorted(unknown_ids))}"
        )
    return output
