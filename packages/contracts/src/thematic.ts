import type { Assertion, Entity, EntityType } from "./knowledge";
import type { PassageId } from "./ids";
import type { Page, PageRequest } from "./queries";
import type { ReviewStatus, TemporalValue } from "./common";
import type { SpatiotemporalOccurrence } from "./spacetime";

export type SocietyTopic =
  | "kinship"
  | "education"
  | "office"
  | "association"
  | "mobility"
  | "events"
  | "livelihood";

export interface ThematicRecord {
  readonly entity: Entity;
  readonly topics: readonly SocietyTopic[];
  readonly assertions: readonly Assertion[];
  readonly occurrences: readonly SpatiotemporalOccurrence[];
  readonly relatedEntities: readonly Entity[];
  readonly evidencePassageIds: readonly PassageId[];
}

export interface SocietyTopicSummary {
  readonly topic: SocietyTopic;
  readonly entityCount: number;
  readonly assertionCount: number;
  readonly occurrenceCount: number;
  readonly evidencePassageCount: number;
}

export interface SocietyQuery extends PageRequest {
  readonly text?: string;
  readonly topics?: readonly SocietyTopic[];
  readonly temporal?: TemporalValue;
  readonly reviewStatuses?: readonly ReviewStatus[];
}

export interface SocietyResult {
  readonly topics: readonly SocietyTopicSummary[];
  readonly records: Page<ThematicRecord>;
}

export interface HeritageRecord {
  readonly entity: Entity;
  readonly assertions: readonly Assertion[];
  readonly occurrences: readonly SpatiotemporalOccurrence[];
  readonly relatedEntities: readonly Entity[];
  readonly evidencePassageIds: readonly PassageId[];
}

export interface HeritageQuery extends PageRequest {
  readonly text?: string;
  readonly types?: readonly EntityType[];
  readonly temporal?: TemporalValue;
  readonly reviewStatuses?: readonly ReviewStatus[];
}
