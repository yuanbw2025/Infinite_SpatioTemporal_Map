import type { Passage, Work } from "./catalog";
import type { TemporalValue } from "./common";
import type { Assertion, Entity, EntityType, Mention } from "./knowledge";
import type { EditionId, EntityId, PassageId, VolumeId, WorkId } from "./ids";
import type { PublicationManifest } from "./publication";
import type {
  MapObservation,
  PlaceIdentity,
  SpatiotemporalOccurrence,
} from "./spacetime";

export interface PageRequest {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

export interface WorkQuery extends PageRequest {
  readonly text?: string;
  readonly region?: string;
  readonly temporal?: TemporalValue;
  readonly categories?: readonly Work["category"][];
}

export interface SearchQuery extends PageRequest {
  readonly text: string;
  readonly entityTypes?: readonly EntityType[];
  readonly workIds?: readonly WorkId[];
  readonly temporal?: TemporalValue;
}

export type SearchHit =
  | { readonly kind: "work"; readonly score: number; readonly work: Work }
  | {
      readonly kind: "passage";
      readonly score: number;
      readonly passage: Passage;
    }
  | {
      readonly kind: "entity";
      readonly score: number;
      readonly entity: Entity;
    };

export interface AtlasQuery extends PageRequest {
  readonly west?: number;
  readonly south?: number;
  readonly east?: number;
  readonly north?: number;
  readonly temporal?: TemporalValue;
  readonly entityTypes?: readonly EntityType[];
  readonly entityIds?: readonly EntityId[];
}

export interface PassageQuery extends PageRequest {
  readonly workId: WorkId;
  readonly editionId?: EditionId;
  readonly volumeId?: VolumeId;
}

export interface PassageContext {
  readonly passage: Passage;
  readonly previousPassageId?: PassageId;
  readonly nextPassageId?: PassageId;
  readonly mentions: readonly Mention[];
  readonly mentionedEntities: readonly Entity[];
  readonly evidencedAssertions: readonly Assertion[];
}

export interface EntityQuery extends PageRequest {
  readonly text?: string;
  readonly types?: readonly EntityType[];
  readonly reviewStatuses?: readonly string[];
}

export interface EntitySummary {
  readonly entity: Entity;
  readonly mentionCount: number;
  readonly assertionCount: number;
  readonly occurrenceCount: number;
}

export interface EntityProfile {
  readonly entity: Entity;
  readonly assertions: readonly Assertion[];
  readonly mentions: readonly Mention[];
  readonly passageIds: readonly PassageId[];
  readonly relatedEntityIds: readonly EntityId[];
  readonly relatedEntities: readonly Entity[];
  readonly occurrences: readonly SpatiotemporalOccurrence[];
  readonly occurrencePlaces: readonly PlaceIdentity[];
}

export interface AtlasResult {
  readonly observations: readonly MapObservation[];
  readonly nextCursor?: string;
}

export interface DatasetOverview {
  readonly manifest: PublicationManifest;
  readonly counts: {
    readonly works: number;
    readonly editions: number;
    readonly volumes: number;
    readonly passages: number;
    readonly entities: number;
    readonly mentions: number;
    readonly assertions: number;
    readonly places: number;
    readonly geometries: number;
    readonly occurrences: number;
  };
}
