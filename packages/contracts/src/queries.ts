import type { Passage, Work } from "./catalog";
import type { TemporalValue } from "./common";
import type { Assertion, Entity, EntityType } from "./knowledge";
import type { EntityId, PassageId, WorkId } from "./ids";
import type { MapObservation } from "./spacetime";

export interface PageRequest {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
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
}

export interface EntityProfile {
  readonly entity: Entity;
  readonly assertions: readonly Assertion[];
  readonly passageIds: readonly PassageId[];
  readonly relatedEntityIds: readonly EntityId[];
}

export interface AtlasResult {
  readonly observations: readonly MapObservation[];
  readonly nextCursor?: string;
}
