import type { Edition, Passage, Volume, Work } from "./catalog";
import type { Assertion, Entity, Mention } from "./knowledge";
import type {
  HistoricalGeometry,
  PlaceIdentity,
  SpatiotemporalOccurrence,
} from "./spacetime";

export interface PublicationManifest {
  readonly contractVersion: string;
  readonly publicationId: string;
  readonly title: string;
  readonly generatedAt: string;
  readonly sourceDescription: string;
}

/** Portable boundary consumed by static, database, or remote API adapters. */
export interface KnowledgePublication {
  readonly manifest: PublicationManifest;
  readonly works: readonly Work[];
  readonly editions: readonly Edition[];
  readonly volumes: readonly Volume[];
  readonly passages: readonly Passage[];
  readonly entities: readonly Entity[];
  readonly mentions: readonly Mention[];
  readonly assertions: readonly Assertion[];
  readonly places: readonly PlaceIdentity[];
  readonly geometries: readonly HistoricalGeometry[];
  readonly occurrences: readonly SpatiotemporalOccurrence[];
}
