import type {
  Assertion,
  AtlasQuery,
  AtlasResult,
  DatasetOverview,
  DataContext,
  Edition,
  EditionId,
  Entity,
  EntityId,
  EntityProfile,
  EntityQuery,
  EntitySummary,
  KnowledgeGraphQuery,
  KnowledgeGraphResult,
  Page,
  PageRequest,
  Passage,
  PassageContext,
  PassageId,
  PassageQuery,
  SearchHit,
  SearchQuery,
  SourceId,
  SourceRecord,
  ResearchQuery,
  ResearchReport,
  TimelineQuery,
  TimelineResult,
  Volume,
  Work,
  WorkId,
  WorkQuery,
} from "@infinite-spacetime/contracts";

/** Read ports are grouped by user capability, not by storage technology. */
export interface CatalogRepository {
  listWorks(query?: WorkQuery): Promise<Page<Work>>;
  getWork(id: WorkId): Promise<Work | null>;
  listEditions(workId: WorkId): Promise<readonly Edition[]>;
  listVolumes(editionId: EditionId): Promise<readonly Volume[]>;
  listSources(sourceIds: readonly SourceId[]): Promise<readonly SourceRecord[]>;
}

export interface ReaderRepository {
  getPassage(id: PassageId): Promise<Passage | null>;
  getPassageContext(id: PassageId): Promise<PassageContext | null>;
  listPassages(query: PassageQuery): Promise<Page<Passage>>;
}

export interface KnowledgeRepository {
  getEntity(id: EntityId): Promise<Entity | null>;
  getEntityProfile(id: EntityId): Promise<EntityProfile | null>;
  listEntities(query?: EntityQuery): Promise<Page<EntitySummary>>;
  findAssertionsByEntity(id: EntityId): Promise<readonly Assertion[]>;
}

export interface AtlasRepository {
  exploreAtlas(query: AtlasQuery): Promise<AtlasResult>;
}

export interface SearchRepository {
  search(query: SearchQuery): Promise<Page<SearchHit>>;
}

export interface MetadataRepository {
  getDatasetOverview(): Promise<DatasetOverview>;
}

export interface KnowledgeGraphRepository {
  exploreGraph(query?: KnowledgeGraphQuery): Promise<KnowledgeGraphResult>;
}

export interface TimelineRepository {
  buildTimeline(query?: TimelineQuery): Promise<TimelineResult>;
}

export interface ResearchRepository {
  inspectResearch(query?: ResearchQuery): Promise<ResearchReport>;
}

export interface RepositoryBundle {
  /** One identity for the complete bundle; mixing publications is forbidden. */
  readonly dataContext: DataContext;
  readonly catalog: CatalogRepository;
  readonly reader: ReaderRepository;
  readonly knowledge: KnowledgeRepository;
  readonly atlas: AtlasRepository;
  readonly search: SearchRepository;
  readonly metadata: MetadataRepository;
  readonly graph: KnowledgeGraphRepository;
  readonly timeline: TimelineRepository;
  readonly research: ResearchRepository;
}
