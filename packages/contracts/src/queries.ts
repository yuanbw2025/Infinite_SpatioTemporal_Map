import type {
  Edition,
  FacsimileAnchor,
  FacsimilePage,
  Passage,
  PassageAlignment,
  SourceRecord,
  SourceRelation,
  Volume,
  Work,
} from "./catalog";
import type { TemporalValue } from "./common";
import type { Assertion, Entity, EntityType, Mention } from "./knowledge";
import type {
  AssertionId,
  EditionId,
  EntityId,
  PassageId,
  PlaceIdentityId,
  SourceId,
  VolumeId,
  WorkId,
} from "./ids";
import type { EvidenceSpan, ReviewStatus } from "./common";
import type { PublicationManifest } from "./publication";
import type { PredicateId } from "./predicate-vocabulary";
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

/** Immutable identity shared by every use case in one application runtime. */
export type DataContext = Readonly<
  Pick<
    PublicationManifest,
    "contractVersion" | "publicationId" | "datasetVersion" | "contentChecksum"
  >
>;

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
  readonly region?: string;
  readonly reviewStatuses?: readonly ReviewStatus[];
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
  readonly work: Work;
  readonly edition: Edition;
  readonly volume: Volume;
  readonly facsimiles: readonly PassageFacsimile[];
  readonly previousPassageId?: PassageId;
  readonly nextPassageId?: PassageId;
  readonly mentions: readonly Mention[];
  readonly mentionedEntities: readonly Entity[];
  readonly evidencedAssertions: readonly Assertion[];
}

export interface PassageFacsimile {
  readonly anchor: FacsimileAnchor;
  readonly page: FacsimilePage;
}

export interface EditionComparisonQuery {
  readonly workId: WorkId;
  readonly leftEditionId: EditionId;
  readonly rightEditionId: EditionId;
}

export interface TextDiffSegment {
  readonly kind: "equal" | "inserted" | "removed";
  readonly text: string;
}

export interface TextComparison {
  readonly left: readonly TextDiffSegment[];
  readonly right: readonly TextDiffSegment[];
  readonly similarity: number;
  readonly isCoarse: boolean;
}

export interface EditionComparisonRow {
  readonly key: string;
  readonly label: string;
  readonly alignment: "curated" | "label" | "sequence" | "unpaired";
  readonly left: readonly Passage[];
  readonly right: readonly Passage[];
  readonly curatedAlignment?: PassageAlignment;
  readonly difference?: TextComparison;
}

export interface EditionComparisonResult {
  readonly leftEdition: Edition;
  readonly rightEdition: Edition;
  readonly rows: readonly EditionComparisonRow[];
}

/** Resolved display resource. This is a use-case projection, not canonical data. */
export interface FacsimileImageResource {
  readonly imageUrl: string;
  readonly canvasUrl?: string;
  readonly width?: number;
  readonly height?: number;
  readonly source: "direct" | "iiif";
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
  readonly occurrencePlaceEntities: readonly Entity[];
}

export interface WorkDetails {
  readonly work: Work;
  readonly editions: readonly Edition[];
  readonly sources: readonly SourceRecord[];
}

export interface SourceProvenanceQuery {
  readonly sourceId: SourceId;
  readonly depth?: number;
}

export interface SourceProvenance {
  readonly center: SourceRecord;
  readonly sources: readonly SourceRecord[];
  readonly relations: readonly SourceRelation[];
  readonly works: readonly Work[];
  readonly editions: readonly Edition[];
}

export interface AtlasResult {
  readonly observations: readonly MapObservation[];
  readonly nextCursor?: string;
}

export interface DatasetOverview {
  readonly manifest: PublicationManifest;
  readonly counts: {
    readonly works: number;
    readonly sources: number;
    readonly sourceRelations: number;
    readonly editions: number;
    readonly volumes: number;
    readonly passages: number;
    readonly passageAlignments: number;
    readonly entities: number;
    readonly mentions: number;
    readonly assertions: number;
    readonly places: number;
    readonly geometries: number;
    readonly occurrences: number;
  };
  readonly quality: {
    readonly reviewCounts: Readonly<Record<ReviewStatus, number>>;
    readonly coverage: {
      readonly facsimilePassages: number;
      readonly simplifiedPassages: number;
      readonly translatedPassages: number;
      readonly evidencedAssertions: number;
      readonly datedAssertions: number;
      readonly locatedPlaces: number;
      readonly datedOccurrences: number;
    };
  };
}

export interface KnowledgeGraphQuery {
  readonly centerEntityId?: EntityId;
  readonly entityTypes?: readonly EntityType[];
  readonly reviewStatuses?: readonly ReviewStatus[];
  readonly depth?: number;
  readonly limit?: number;
}

export interface KnowledgeGraphNode {
  readonly entity: Entity;
  readonly mentionCount: number;
  readonly assertionCount: number;
  readonly occurrenceCount: number;
}

export interface KnowledgeGraphEdge {
  readonly assertionId: AssertionId;
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
  readonly predicate: PredicateId;
  readonly predicateLabel: string;
  readonly temporal?: TemporalValue;
  readonly evidence: readonly EvidenceSpan[];
  readonly reviewStatus: ReviewStatus;
}

export interface KnowledgeGraphResult {
  readonly nodes: readonly KnowledgeGraphNode[];
  readonly edges: readonly KnowledgeGraphEdge[];
  readonly truncated: boolean;
}

export interface TimelineQuery {
  readonly entityIds?: readonly EntityId[];
  readonly entityTypes?: readonly EntityType[];
  readonly workIds?: readonly WorkId[];
  readonly startYear?: number;
  readonly endYear?: number;
  readonly limit?: number;
}

export interface TimelineItem {
  readonly id: string;
  readonly kind: "occurrence" | "assertion";
  readonly entityId: EntityId;
  readonly label: string;
  readonly temporal: TemporalValue;
  readonly placeId?: PlaceIdentityId;
  readonly predicate?: PredicateId;
  readonly predicateLabel?: string;
  readonly evidence: readonly EvidenceSpan[];
  readonly reviewStatus: ReviewStatus;
}

export interface TimelineTrack {
  readonly entity: Entity;
  readonly items: readonly TimelineItem[];
}

export interface TimelineResult {
  readonly tracks: readonly TimelineTrack[];
  readonly range?: {
    readonly startYear: number;
    readonly endYear: number;
  };
  readonly undatedCount: number;
  readonly truncated: boolean;
}

export type ResearchFindingKind =
  | "contradictory_assertions"
  | "disputed_record"
  | "unresolved_geometry"
  | "chronology_conflict";

export interface ResearchQuery {
  readonly entityIds?: readonly EntityId[];
  readonly workIds?: readonly WorkId[];
  readonly kinds?: readonly ResearchFindingKind[];
  readonly limit?: number;
}

export interface ResearchFinding {
  readonly id: string;
  readonly ruleId: string;
  readonly kind: ResearchFindingKind;
  readonly severity: "notice" | "warning" | "critical";
  readonly title: string;
  readonly description: string;
  readonly entityIds: readonly EntityId[];
  readonly assertionIds: readonly AssertionId[];
  readonly passageIds: readonly PassageId[];
}

export interface ResearchReport {
  readonly findings: readonly ResearchFinding[];
  readonly counts: Readonly<Record<ResearchFindingKind, number>>;
  readonly truncated: boolean;
}
