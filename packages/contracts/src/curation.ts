import type { ReviewStatus } from "./common";

export type CandidateKind =
  "entity" | "mention" | "assertion" | "place" | "geometry" | "occurrence";

export interface CandidateEvidence {
  readonly passageId: string;
  readonly start: number;
  readonly end: number;
  readonly note?: string;
}

export interface CandidateReviewEvent {
  readonly status: Exclude<ReviewStatus, "raw" | "machine_suggested">;
  readonly reviewer: string;
  readonly decidedAt: string;
  readonly note?: string;
  readonly correctedPayload?: Readonly<Record<string, unknown>>;
}

export interface CurationCandidate {
  readonly id: string;
  readonly kind: CandidateKind;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly evidence: readonly CandidateEvidence[];
  readonly status: ReviewStatus;
  readonly confidence?: number;
  readonly notes?: string;
  readonly reviewHistory: readonly CandidateReviewEvent[];
}

export interface CandidateBatch {
  readonly version: 1;
  readonly publicationId: string;
  /** Checksum of the exact publication from which evidence was extracted. */
  readonly baseContentChecksum: string;
  readonly generatorId: string;
  readonly generatedAt: string;
  readonly candidates: readonly CurationCandidate[];
}

export interface CandidateReviewDecision {
  readonly candidateId: string;
  readonly status: Exclude<ReviewStatus, "raw" | "machine_suggested">;
  readonly reviewer: string;
  readonly decidedAt: string;
  readonly note?: string;
  readonly correctedPayload?: Readonly<Record<string, unknown>>;
}

export type AlignmentKind = "entity" | "place";
export type AlignmentResolution =
  "merge_existing" | "create_new" | "keep_separate";

export interface AlignmentMatch {
  readonly targetId: string;
  readonly label: string;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface AlignmentItem {
  readonly id: string;
  readonly candidateId: string;
  readonly kind: AlignmentKind;
  readonly sourceLabel: string;
  readonly sourcePayload: Readonly<Record<string, unknown>>;
  readonly matches: readonly AlignmentMatch[];
  readonly suggestion: AlignmentResolution | "manual_review";
}

export interface AlignmentBatch {
  readonly version: 1;
  readonly publicationId: string;
  readonly baseContentChecksum: string;
  readonly generatedAt: string;
  readonly alignerId: string;
  readonly items: readonly AlignmentItem[];
}

export interface AlignmentDecision {
  readonly alignmentId: string;
  readonly resolution: AlignmentResolution;
  readonly reviewer: string;
  readonly decidedAt: string;
  readonly targetId?: string;
  readonly note?: string;
}
