"""Attach OCR or manual transcription while preserving the source audit chain."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


class TranscriptionError(ValueError):
    """Raised when a transcript cannot be safely attached to a source record."""


def _read_transcript(path: Path) -> str:
    data = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "big5"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise TranscriptionError("transcript encoding cannot be identified reliably")


def attach_transcription(
    source_record: dict[str, Any],
    transcript_path: Path,
    *,
    method: str,
    agent: str,
    created_at: str | None = None,
) -> dict[str, Any]:
    if method not in {"ocr", "manual", "hybrid"}:
        raise TranscriptionError("method must be ocr, manual, or hybrid")
    if not agent.strip():
        raise TranscriptionError("agent is required for provenance")
    source_sha256 = source_record.get("sha256")
    if not isinstance(source_sha256, str) or len(source_sha256) != 64:
        raise TranscriptionError("source record has no valid source sha256")
    resolved = transcript_path.expanduser().resolve()
    if not resolved.is_file():
        raise TranscriptionError(f"transcript does not exist: {resolved}")
    text = _read_transcript(resolved)
    if not text.strip():
        raise TranscriptionError("transcript is empty")
    transcript_bytes = resolved.read_bytes()
    transcript_sha256 = hashlib.sha256(transcript_bytes).hexdigest()
    previous_metadata = source_record.get("metadata")
    metadata = dict(previous_metadata) if isinstance(previous_metadata, dict) else {}
    metadata["transcription"] = {
        "method": method,
        "agent": agent,
        "createdAt": created_at or datetime.now(UTC).isoformat(),
        "transcriptPath": str(resolved),
        "transcriptSha256": transcript_sha256,
        "sourceSha256": source_sha256,
    }
    warnings = source_record.get("warnings")
    return {
        **source_record,
        "text": text,
        "extractor_id": f"transcription-{method}",
        "requires_ocr": False,
        "warnings": [
            *(warnings if isinstance(warnings, list) else []),
            "派生文本已接入；原件校验值和转录文件校验值均已保留。",
        ],
        "metadata": metadata,
    }
