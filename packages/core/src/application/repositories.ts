import type {
  Assertion,
  AtlasQuery,
  AtlasResult,
  DatasetOverview,
  Edition,
  EditionId,
  Entity,
  EntityId,
  EntityProfile,
  EntityQuery,
  EntitySummary,
  Page,
  PageRequest,
  Passage,
  PassageContext,
  PassageId,
  PassageQuery,
  SearchHit,
  SearchQuery,
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

export interface RepositoryBundle {
  readonly catalog: CatalogRepository;
  readonly reader: ReaderRepository;
  readonly knowledge: KnowledgeRepository;
  readonly atlas: AtlasRepository;
  readonly search: SearchRepository;
  readonly metadata: MetadataRepository;
}
