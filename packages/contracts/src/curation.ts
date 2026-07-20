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

export type PassageAlignmentRelation =
  "equivalent" | "partial_overlap" | "reordered" | "uncertain";
export type PassageAlignmentReviewStatus = "reviewed" | "verified" | "disputed";
export type PassageAlignmentResolution = "accept" | "modify" | "reject";

export interface PassageAlignmentReviewPassage {
  readonly id: string;
  readonly volumeLabel: string;
  readonly sectionLabel?: string;
  readonly sequence: number;
  readonly textOriginal: string;
}

export interface PassageAlignmentSuggestion {
  readonly id: string;
  readonly leftPassageIds: readonly string[];
  readonly rightPassageIds: readonly string[];
  readonly suggestedRelation: PassageAlignmentRelation;
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface PassageAlignmentBatch {
  readonly version: 1;
  readonly publicationId: string;
  readonly baseContentChecksum: string;
  readonly workId: string;
  readonly leftEditionId: string;
  readonly rightEditionId: string;
  readonly generatorId: string;
  readonly generatedAt: string;
  readonly leftPassages: readonly PassageAlignmentReviewPassage[];
  readonly rightPassages: readonly PassageAlignmentReviewPassage[];
  readonly items: readonly PassageAlignmentSuggestion[];
}

export interface PassageAlignmentDecision {
  readonly suggestionId: string;
  readonly resolution: PassageAlignmentResolution;
  readonly relation?: PassageAlignmentRelation;
  readonly leftPassageIds?: readonly string[];
  readonly rightPassageIds?: readonly string[];
  readonly reviewStatus: PassageAlignmentReviewStatus;
  readonly reviewer: string;
  readonly decidedAt: string;
  readonly note?: string;
}

interface DecisionBundleBase {
  readonly version: 1;
  readonly bundleId: string;
  readonly publicationId: string;
  readonly baseContentChecksum: string;
  readonly batchKey: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly sourceBundleIds?: readonly string[];
}

export interface CandidateReviewDecisionBundle extends DecisionBundleBase {
  readonly workspace: "candidate_review";
  readonly decisions: readonly CandidateReviewDecision[];
}

export interface AlignmentDecisionBundle extends DecisionBundleBase {
  readonly workspace: "entity_alignment";
  readonly decisions: readonly AlignmentDecision[];
}

export interface PassageAlignmentDecisionBundle extends DecisionBundleBase {
  readonly workspace: "passage_alignment";
  readonly decisions: readonly PassageAlignmentDecision[];
}

export type DecisionBundle =
  | CandidateReviewDecisionBundle
  | AlignmentDecisionBundle
  | PassageAlignmentDecisionBundle;

export interface DecisionConflictVariant {
  readonly sourceBundleId: string;
  readonly reviewer: string;
  readonly decidedAt: string;
  readonly decision: Readonly<Record<string, unknown>>;
}

export interface DecisionConflict {
  readonly decisionId: string;
  readonly variants: readonly DecisionConflictVariant[];
}

export interface DecisionMergeReport {
  readonly sourceBundleIds: readonly string[];
  readonly mergedDecisionCount: number;
  readonly equivalentDecisionCount: number;
  readonly conflicts: readonly DecisionConflict[];
}
