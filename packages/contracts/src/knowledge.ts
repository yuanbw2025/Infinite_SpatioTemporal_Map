import type { EvidenceSpan, ReviewStatus, TemporalValue } from "./common";
import type { AssertionId, EntityId, MentionId, PassageId } from "./ids";

export type EntityType =
  | "person"
  | "place"
  | "time"
  | "office"
  | "institution"
  | "event"
  | "artifact"
  | "site"
  | "material"
  | "technique"
  | "motif"
  | "inscription";

export interface Entity {
  readonly id: EntityId;
  readonly type: EntityType;
  readonly preferredName: string;
  readonly aliases: readonly string[];
  readonly summary?: string;
  readonly reviewStatus?: ReviewStatus;
}

export interface Mention {
  readonly id: MentionId;
  readonly passageId: PassageId;
  readonly entityId: EntityId;
  readonly start: number;
  readonly end: number;
  readonly surface: string;
  readonly confidence?: number;
  readonly reviewStatus: ReviewStatus;
}

export interface Assertion {
  readonly id: AssertionId;
  readonly subjectId: EntityId;
  readonly predicate: string;
  readonly objectId?: EntityId;
  readonly literalValue?: string;
  readonly temporal?: TemporalValue;
  readonly evidence: readonly EvidenceSpan[];
  readonly reviewStatus: ReviewStatus;
}
