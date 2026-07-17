import type * as Wire from "./generated/publication";
import type { PassageId } from "./ids";

export type ReviewStatus = Wire.ReviewStatus;
export type Certainty = Wire.TemporalValue["certainty"];

export type EvidenceSpan = Readonly<
  Omit<Wire.EvidenceSpan, "passageId"> & { readonly passageId: PassageId }
>;

export type TemporalValue = Readonly<Wire.TemporalValue>;

export interface RevisionInfo {
  readonly revision: number;
  readonly updatedAt: string;
  readonly reviewedBy?: string;
}
