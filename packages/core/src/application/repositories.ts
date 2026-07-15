import type {
  Assertion,
  AtlasQuery,
  AtlasResult,
  Edition,
  EditionId,
  Entity,
  EntityId,
  EntityProfile,
  Page,
  PageRequest,
  Passage,
  PassageId,
  SearchHit,
  SearchQuery,
  Volume,
  Work,
  WorkId,
} from "@infinite-spacetime/contracts";

/** Read ports are grouped by user capability, not by storage technology. */
export interface CatalogRepository {
  listWorks(request?: PageRequest): Promise<Page<Work>>;
  getWork(id: WorkId): Promise<Work | null>;
  listEditions(workId: WorkId): Promise<readonly Edition[]>;
  listVolumes(editionId: EditionId): Promise<readonly Volume[]>;
}

export interface ReaderRepository {
  getPassage(id: PassageId): Promise<Passage | null>;
  listPassages(workId: WorkId, request?: PageRequest): Promise<Page<Passage>>;
}

export interface KnowledgeRepository {
  getEntity(id: EntityId): Promise<Entity | null>;
  getEntityProfile(id: EntityId): Promise<EntityProfile | null>;
  findAssertionsByEntity(id: EntityId): Promise<readonly Assertion[]>;
}

export interface AtlasRepository {
  exploreAtlas(query: AtlasQuery): Promise<AtlasResult>;
}

export interface SearchRepository {
  search(query: SearchQuery): Promise<Page<SearchHit>>;
}

export interface RepositoryBundle {
  readonly catalog: CatalogRepository;
  readonly reader: ReaderRepository;
  readonly knowledge: KnowledgeRepository;
  readonly atlas: AtlasRepository;
  readonly search: SearchRepository;
}
