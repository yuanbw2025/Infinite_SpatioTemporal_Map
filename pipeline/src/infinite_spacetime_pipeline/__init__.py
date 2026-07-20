"""Stable data-production boundary for the Infinite SpatioTemporal Map."""

from .models import PipelineContext, PipelineReport, StageReport
from .alignment import AlignmentError, resolve_alignments, suggest_alignments
from .passage_alignment import (
    PassageAlignmentError,
    apply_passage_alignment_decisions,
    suggest_passage_alignments,
)
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
from .migrations import (
    MigrationError,
    migrate_0_3_to_0_4,
    migrate_0_4_to_0_5,
    migrate_0_5_to_0_6,
    migrate_0_6_to_0_7,
    migrate_to_current,
)
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
    "PassageAlignmentError",
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
    "apply_passage_alignment_decisions",
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
    "migrate_0_4_to_0_5",
    "migrate_0_5_to_0_6",
    "migrate_0_6_to_0_7",
    "migrate_to_current",
    "merge_reviewed_candidates",
    "promote_candidates_atomically",
    "validate_publication",
    "write_publication",
    "default_source_registry",
    "extract_source",
    "segment_text",
    "resolve_alignments",
    "suggest_alignments",
    "suggest_passage_alignments",
    "TranscriptionError",
    "verify_source_manifest",
]
