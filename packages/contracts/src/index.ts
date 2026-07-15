export const CONTRACT_VERSION = "0.1.0" as const;

export type Id<Kind extends string> = string & { readonly __kind: Kind };

export type WorkId = Id<"WorkId">;
export type EditionId = Id<"EditionId">;
export type PassageId = Id<"PassageId">;
export type EntityId = Id<"EntityId">;
export type MentionId = Id<"MentionId">;
export type AssertionId = Id<"AssertionId">;

export interface SourceLocator {
  readonly workId: WorkId;
  readonly editionId: EditionId;
  readonly volumeLabel: string;
  readonly sectionLabel?: string;
  readonly pageId?: string;
  readonly passageId: PassageId;
}

export interface TextLayers {
  readonly original: string;
  readonly simplified?: string;
  readonly modernTranslation?: string;
}

export interface Passage {
  readonly id: PassageId;
  readonly source: SourceLocator;
  readonly sequence: number;
  readonly text: TextLayers;
  readonly revision: number;
}

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
}

export type ReviewStatus =
  | "raw"
  | "machine_suggested"
  | "reviewed"
  | "verified"
  | "disputed"
  | "rejected";

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

export interface EvidenceSpan {
  readonly passageId: PassageId;
  readonly start: number;
  readonly end: number;
}

export interface TemporalValue {
  readonly original: string;
  readonly startYear?: number;
  readonly endYear?: number;
  readonly certainty: "exact" | "approximate" | "range" | "unknown";
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
