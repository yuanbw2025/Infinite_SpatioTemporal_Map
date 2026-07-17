"""Stable data-production boundary for the Infinite SpatioTemporal Map."""

from .models import PipelineContext, PipelineReport, StageReport
from .alignment import AlignmentError, resolve_alignments, suggest_alignments
from .curation import (
    CurationError,
    apply_review_decisions,
    candidate_review_summary,
    create_candidate_batch,
    promote_reviewed_candidates,
)
from .intake import (
    SourceManifestError,
    build_source_manifest,
    load_source_metadata,
    verify_source_manifest,
)
from .extractors import CandidateExtractionError, extract_mention_proposals
from .publication import (
    PublicationValidationError,
    assemble_publication,
    validate_publication,
    write_publication,
)
from .migrations import MigrationError, migrate_0_3_to_0_4
from .promotion import merge_reviewed_candidates, promote_candidates_atomically
from .workflow import Pipeline, PipelineStage
from .sources import (
    ExtractedSource,
    SourceAdapter,
    SourceExtractionError,
    SourceRegistry,
    default_source_registry,
    extract_source,
)
from .segmentation import (
    SegmentationError,
    SegmentationResult,
    TextSegment,
    add_text_layer,
    segment_text,
)
from .release import evaluate_release_gate
from .transcription import TranscriptionError, attach_transcription

__all__ = [
    "Pipeline",
    "AlignmentError",
    "PipelineContext",
    "PipelineReport",
    "PipelineStage",
    "CurationError",
    "CandidateExtractionError",
    "PublicationValidationError",
    "MigrationError",
    "StageReport",
    "ExtractedSource",
    "SourceAdapter",
    "SourceExtractionError",
    "SourceRegistry",
    "SourceManifestError",
    "SegmentationError",
    "SegmentationResult",
    "TextSegment",
    "add_text_layer",
    "apply_review_decisions",
    "assemble_publication",
    "attach_transcription",
    "build_source_manifest",
    "candidate_review_summary",
    "create_candidate_batch",
    "promote_reviewed_candidates",
    "evaluate_release_gate",
    "extract_mention_proposals",
    "load_source_metadata",
    "migrate_0_3_to_0_4",
    "merge_reviewed_candidates",
    "promote_candidates_atomically",
    "validate_publication",
    "write_publication",
    "default_source_registry",
    "extract_source",
    "segment_text",
    "resolve_alignments",
    "suggest_alignments",
    "TranscriptionError",
    "verify_source_manifest",
]
