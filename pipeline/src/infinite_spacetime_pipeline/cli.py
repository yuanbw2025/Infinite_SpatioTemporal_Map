"""Command-line entry points for assembling and validating publication data."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .alignment import AlignmentError, resolve_alignments, suggest_alignments
from .curation import (
    CurationError,
    apply_review_decisions,
    create_candidate_batch,
)
from .intake import (
    SourceManifestError,
    build_source_manifest,
    load_source_metadata,
    verify_source_manifest,
)
from .migrations import MigrationError, migrate_0_3_to_0_4
from .extractors import CandidateExtractionError, extract_mention_proposals
from .publication import (
    PublicationValidationError,
    assemble_publication,
    validate_publication,
    write_publication,
)
from .promotion import promote_candidates_atomically
from .release import evaluate_release_gate
from .sources import SourceExtractionError, extract_source
from .segmentation import SegmentationError, add_text_layer, segment_text
from .transcription import TranscriptionError, attach_transcription


def _load_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.write("\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="infinite-spacetime-data")
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate", help="validate a publication JSON")
    validate.add_argument("publication", type=Path)

    migrate = commands.add_parser(
        "migrate-0.3-to-0.4",
        help="loss-aware migration of a 0.3 publication to the canonical 0.4 contract",
    )
    migrate.add_argument("publication", type=Path)
    migrate.add_argument("output", type=Path)
    migrate.add_argument("--report", type=Path)
    migrate.add_argument("--default-source-id")

    assemble = commands.add_parser(
        "assemble", help="assemble manifest and collection JSON files"
    )
    assemble.add_argument("source_dir", type=Path)
    assemble.add_argument("output", type=Path)

    extract = commands.add_parser(
        "extract", help="extract an auditable source staging record"
    )
    extract.add_argument("source", type=Path)
    extract.add_argument("output", type=Path)

    sources = commands.add_parser(
        "sources", help="inventory source files with checksums and rights metadata"
    )
    sources.add_argument("source_dir", type=Path)
    sources.add_argument("output", type=Path)
    sources.add_argument("--publication-id", required=True)
    sources.add_argument("--metadata", type=Path)

    verify_sources = commands.add_parser(
        "verify-sources", help="verify source files against an inventory"
    )
    verify_sources.add_argument("manifest", type=Path)
    verify_sources.add_argument("source_dir", type=Path)
    verify_sources.add_argument("--require-publishable-rights", action="store_true")
    verify_sources.add_argument("--output", type=Path)

    transcribe = commands.add_parser(
        "transcribe", help="attach OCR or manual text to an extracted source record"
    )
    transcribe.add_argument("source_record", type=Path)
    transcribe.add_argument("transcript", type=Path)
    transcribe.add_argument("output", type=Path)
    transcribe.add_argument("--method", choices=("ocr", "manual", "hybrid"), required=True)
    transcribe.add_argument("--agent", required=True)

    segment = commands.add_parser(
        "segment", help="losslessly segment an extracted source record"
    )
    segment.add_argument("source_record", type=Path)
    segment.add_argument("output", type=Path)
    segment.add_argument("--publication-id", required=True)
    segment.add_argument("--source-key", required=True)
    segment.add_argument("--max-chars", type=int, default=2000)

    layer = commands.add_parser(
        "layer", help="attach a derived text layer without overwriting original text"
    )
    layer.add_argument("segmentation", type=Path)
    layer.add_argument("values", type=Path)
    layer.add_argument("output", type=Path)
    layer.add_argument(
        "--layer",
        choices=("simplified", "punctuated", "modernTranslation"),
        required=True,
    )

    candidates = commands.add_parser(
        "candidates", help="normalize extractor proposals into a stable review batch"
    )
    candidates.add_argument("proposals", type=Path)
    candidates.add_argument("output", type=Path)
    candidates.add_argument("--publication", type=Path, required=True)
    candidates.add_argument("--generator-id", required=True)

    mentions = commands.add_parser(
        "extract-mentions",
        help="find exact original-text mentions from a reviewed entity lexicon",
    )
    mentions.add_argument("segmentation", type=Path)
    mentions.add_argument("lexicon", type=Path)
    mentions.add_argument("output", type=Path)

    align = commands.add_parser(
        "align", help="suggest conservative entity and historical-place matches"
    )
    align.add_argument("candidate_batch", type=Path)
    align.add_argument("publication", type=Path)
    align.add_argument("output", type=Path)

    resolve = commands.add_parser(
        "resolve-alignments",
        help="apply complete human alignment decisions and rewrite references",
    )
    resolve.add_argument("candidate_batch", type=Path)
    resolve.add_argument("publication", type=Path)
    resolve.add_argument("alignment_batch", type=Path)
    resolve.add_argument("decisions", type=Path)
    resolve.add_argument("output_dir", type=Path)

    review = commands.add_parser(
        "review", help="apply append-only human decisions to a candidate batch"
    )
    review.add_argument("candidate_batch", type=Path)
    review.add_argument("decisions", type=Path)
    review.add_argument("output", type=Path)

    promote = commands.add_parser(
        "promote",
        help="merge reviewed candidates into a fully validated publication atomically",
    )
    promote.add_argument("candidate_batch", type=Path)
    promote.add_argument("publication", type=Path)
    promote.add_argument("output", type=Path)

    gate = commands.add_parser(
        "gate", help="evaluate whether a publication is safe for formal release"
    )
    gate.add_argument("publication", type=Path)
    gate.add_argument("--source-manifest", type=Path)
    gate.add_argument("--source-dir", type=Path)
    gate.add_argument("--candidate-batch", type=Path)
    gate.add_argument("--output", type=Path)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "validate":
            with args.publication.open("r", encoding="utf-8") as file:
                validate_publication(json.load(file))
            print(f"Valid publication: {args.publication}")
        elif args.command == "migrate-0.3-to-0.4":
            publication, report = migrate_0_3_to_0_4(
                _load_json(args.publication),
                default_source_id=args.default_source_id,
            )
            _write_json(args.output, publication)
            if args.report:
                _write_json(args.report, report)
            print(json.dumps(report, ensure_ascii=False, indent=2))
        elif args.command == "assemble":
            publication = assemble_publication(args.source_dir)
            write_publication(publication, args.output)
            print(f"Published: {args.output}")
        elif args.command == "extract":
            source = extract_source(args.source)
            _write_json(args.output, source.to_dict())
            print(f"Extracted source: {args.output}")
        elif args.command == "sources":
            metadata = load_source_metadata(args.metadata)
            manifest = build_source_manifest(
                args.source_dir,
                publication_id=args.publication_id,
                metadata=metadata,
            )
            _write_json(args.output, manifest)
            print(f"Inventoried {len(manifest['sources'])} sources: {args.output}")
        elif args.command == "verify-sources":
            report = verify_source_manifest(
                _load_json(args.manifest),
                source_dir=args.source_dir,
                require_publishable_rights=args.require_publishable_rights,
            )
            if args.output:
                _write_json(args.output, report)
            print(json.dumps(report, ensure_ascii=False, indent=2))
            if not report["passed"]:
                return 1
        elif args.command == "transcribe":
            source = attach_transcription(
                _load_json(args.source_record),
                args.transcript,
                method=args.method,
                agent=args.agent,
            )
            _write_json(args.output, source)
            print(f"Attached transcription: {args.output}")
        elif args.command == "segment":
            source = _load_json(args.source_record)
            if source.get("requires_ocr"):
                raise SegmentationError("source still requires OCR")
            result = segment_text(
                publication_id=args.publication_id,
                source_key=args.source_key,
                source_sha256=source.get("sha256", ""),
                text=source.get("text", ""),
                max_chars=args.max_chars,
            )
            _write_json(args.output, result.to_dict())
            print(f"Segmented source: {args.output}")
        elif args.command == "layer":
            segmentation = _load_json(args.segmentation)
            values = _load_json(args.values)
            if not isinstance(values, dict) or not all(
                isinstance(key, str) and isinstance(value, str)
                for key, value in values.items()
            ):
                raise SegmentationError("values must be a JSON object of segment id to text")
            result = add_text_layer(segmentation, layer=args.layer, values=values)
            _write_json(args.output, result)
            print(f"Attached {args.layer} layer: {args.output}")
        elif args.command == "candidates":
            proposals = _load_json(args.proposals)
            if not isinstance(proposals, list):
                raise CurationError("proposals must be a JSON array")
            base_publication = _load_json(args.publication)
            validate_publication(base_publication)
            batch = create_candidate_batch(
                proposals,
                publication_id=base_publication["manifest"]["publicationId"],
                base_content_checksum=base_publication["manifest"]["contentChecksum"],
                generator_id=args.generator_id,
            )
            _write_json(args.output, batch)
            print(f"Prepared {len(batch['candidates'])} candidates: {args.output}")
        elif args.command == "extract-mentions":
            lexicon = _load_json(args.lexicon)
            if not isinstance(lexicon, list):
                raise CandidateExtractionError("lexicon must be a JSON array")
            proposals = extract_mention_proposals(
                _load_json(args.segmentation), lexicon
            )
            _write_json(args.output, proposals)
            print(f"Extracted {len(proposals)} mention proposals: {args.output}")
        elif args.command == "align":
            result = suggest_alignments(
                _load_json(args.candidate_batch), _load_json(args.publication)
            )
            _write_json(args.output, result)
            print(f"Prepared {len(result['items'])} alignment items: {args.output}")
        elif args.command == "resolve-alignments":
            decisions = _load_json(args.decisions)
            if not isinstance(decisions, list):
                raise AlignmentError("alignment decisions must be a JSON array")
            next_candidates, next_publication = resolve_alignments(
                _load_json(args.candidate_batch),
                _load_json(args.publication),
                _load_json(args.alignment_batch),
                decisions,
            )
            validate_publication(next_publication)
            _write_json(args.output_dir / "candidates.aligned.json", next_candidates)
            _write_json(args.output_dir / "publication.aligned.json", next_publication)
            print(f"Resolved {len(decisions)} alignments: {args.output_dir}")
        elif args.command == "review":
            decisions = _load_json(args.decisions)
            if not isinstance(decisions, list):
                raise CurationError("decisions must be a JSON array")
            reviewed = apply_review_decisions(
                _load_json(args.candidate_batch), decisions
            )
            _write_json(args.output, reviewed)
            print(f"Applied {len(decisions)} review decisions: {args.output}")
        elif args.command == "promote":
            report = promote_candidates_atomically(
                _load_json(args.publication),
                _load_json(args.candidate_batch),
                args.output,
            )
            print(json.dumps(report, ensure_ascii=False, indent=2))
        elif args.command == "gate":
            if bool(args.source_manifest) != bool(args.source_dir):
                raise SourceManifestError(
                    "--source-manifest and --source-dir must be supplied together"
                )
            source_report = (
                verify_source_manifest(
                    _load_json(args.source_manifest),
                    source_dir=args.source_dir,
                    require_publishable_rights=True,
                )
                if args.source_manifest and args.source_dir
                else None
            )
            candidate_batch = (
                _load_json(args.candidate_batch) if args.candidate_batch else None
            )
            report = evaluate_release_gate(
                _load_json(args.publication),
                source_report=source_report,
                candidate_batch=candidate_batch,
            )
            if args.output:
                _write_json(args.output, report)
            print(json.dumps(report, ensure_ascii=False, indent=2))
            if not report["passed"]:
                return 1
    except (
        OSError,
        json.JSONDecodeError,
        PublicationValidationError,
        SourceExtractionError,
        SegmentationError,
        SourceManifestError,
        TranscriptionError,
        CurationError,
        CandidateExtractionError,
        AlignmentError,
        MigrationError,
    ) as error:
        print(f"Publication failed: {error}")
        return 1
    return 0
