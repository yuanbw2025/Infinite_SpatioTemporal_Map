import type { PassageId } from "./ids";

export type ReviewStatus =
  | "raw"
  | "machine_suggested"
  | "reviewed"
  | "verified"
  | "disputed"
  | "rejected";

export type Certainty = "exact" | "approximate" | "range" | "unknown";

export interface EvidenceSpan {
  readonly passageId: PassageId;
  readonly start: number;
  readonly end: number;
  readonly note?: string;
}

export interface TemporalValue {
  readonly original: string;
  readonly startYear?: number;
  readonly endYear?: number;
  readonly certainty: Certainty;
  readonly calendar?: string;
}

export interface RevisionInfo {
  readonly revision: number;
  readonly updatedAt: string;
  readonly reviewedBy?: string;
}
