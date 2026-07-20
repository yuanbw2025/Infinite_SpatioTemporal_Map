import type * as Wire from "./generated/publication";
import type {
  Edition,
  FacsimilePage,
  Passage,
  PassageAlignment,
  SourceRecord,
  SourceRelation,
  Volume,
  Work,
} from "./catalog";
import type { Assertion, Entity, Mention } from "./knowledge";
import type { PublicationId } from "./ids";
import type {
  HistoricalGeometry,
  PlaceIdentity,
  SpatiotemporalOccurrence,
} from "./spacetime";

export type PublicationManifest = Readonly<
  Omit<Wire.PublicationManifest, "publicationId"> & {
    readonly publicationId: PublicationId;
  }
>;

/** Portable boundary consumed by static, database, or remote API adapters. */
export interface KnowledgePublication {
  readonly manifest: PublicationManifest;
  readonly sources: readonly SourceRecord[];
  readonly sourceRelations: readonly SourceRelation[];
  readonly works: readonly Work[];
  readonly editions: readonly Edition[];
  readonly volumes: readonly Volume[];
  readonly facsimilePages: readonly FacsimilePage[];
  readonly passages: readonly Passage[];
  readonly passageAlignments: readonly PassageAlignment[];
  readonly entities: readonly Entity[];
  readonly mentions: readonly Mention[];
  readonly assertions: readonly Assertion[];
  readonly places: readonly PlaceIdentity[];
  readonly geometries: readonly HistoricalGeometry[];
  readonly occurrences: readonly SpatiotemporalOccurrence[];
}
