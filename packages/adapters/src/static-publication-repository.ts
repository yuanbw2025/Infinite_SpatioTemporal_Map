import {
  CONTRACT_VERSION,
  type Assertion,
  type AtlasQuery,
  type AtlasResult,
  type Edition,
  type EditionId,
  type Entity,
  type EntityId,
  type EntityProfile,
  type KnowledgePublication,
  type Page,
  type PageRequest,
  type Passage,
  type PassageId,
  type SearchHit,
  type SearchQuery,
  type Volume,
  type Work,
  type WorkId,
} from "@infinite-spacetime/contracts";
import type {
  AtlasRepository,
  CatalogRepository,
  KnowledgeRepository,
  ReaderRepository,
  RepositoryBundle,
  SearchRepository,
} from "@infinite-spacetime/core";
import { ContractMismatchError } from "@infinite-spacetime/core";

type StaticRepository = CatalogRepository &
  ReaderRepository &
  KnowledgeRepository &
  AtlasRepository &
  SearchRepository;

function paginate<T>(items: readonly T[], request: PageRequest = {}): Page<T> {
  const start = Number.parseInt(request.cursor ?? "0", 10) || 0;
  const limit = Math.min(Math.max(request.limit ?? 50, 1), 200);
  const pageItems = items.slice(start, start + limit);
  const next = start + pageItems.length;
  return next < items.length
    ? { items: pageItems, nextCursor: String(next) }
    : { items: pageItems };
}

export function createStaticPublicationRepository(
  publication: KnowledgePublication,
): RepositoryBundle {
  if (publication.manifest.contractVersion !== CONTRACT_VERSION) {
    throw new ContractMismatchError(
      `Expected contract ${CONTRACT_VERSION}, received ${publication.manifest.contractVersion}`,
    );
  }

  const works = new Map(publication.works.map((item) => [item.id, item]));
  const passages = new Map(publication.passages.map((item) => [item.id, item]));
  const entities = new Map(publication.entities.map((item) => [item.id, item]));

  const repository: StaticRepository = {
    async listWorks(request) {
      return paginate(publication.works, request);
    },
    async getWork(id: WorkId): Promise<Work | null> {
      return works.get(id) ?? null;
    },
    async listEditions(workId: WorkId): Promise<readonly Edition[]> {
      return publication.editions.filter((item) => item.workId === workId);
    },
    async listVolumes(editionId: EditionId): Promise<readonly Volume[]> {
      return publication.volumes.filter((item) => item.editionId === editionId);
    },
    async getPassage(id: PassageId): Promise<Passage | null> {
      return passages.get(id) ?? null;
    },
    async listPassages(workId: WorkId, request): Promise<Page<Passage>> {
      return paginate(
        publication.passages.filter((item) => item.source.workId === workId),
        request,
      );
    },
    async getEntity(id: EntityId): Promise<Entity | null> {
      return entities.get(id) ?? null;
    },
    async findAssertionsByEntity(id: EntityId): Promise<readonly Assertion[]> {
      return publication.assertions.filter(
        (item) => item.subjectId === id || item.objectId === id,
      );
    },
    async getEntityProfile(id: EntityId): Promise<EntityProfile | null> {
      const entity = entities.get(id);
      if (!entity) return null;
      const assertions = publication.assertions.filter(
        (item) => item.subjectId === id || item.objectId === id,
      );
      const passageIds = new Set(
        publication.mentions
          .filter((item) => item.entityId === id)
          .map((item) => item.passageId),
      );
      const relatedEntityIds = new Set<EntityId>();
      for (const assertion of assertions) {
        if (assertion.subjectId !== id)
          relatedEntityIds.add(assertion.subjectId);
        if (assertion.objectId && assertion.objectId !== id) {
          relatedEntityIds.add(assertion.objectId);
        }
      }
      return {
        entity,
        assertions,
        passageIds: [...passageIds],
        relatedEntityIds: [...relatedEntityIds],
      };
    },
    async exploreAtlas(query: AtlasQuery): Promise<AtlasResult> {
      const entityTypeSet = query.entityTypes
        ? new Set(query.entityTypes)
        : undefined;
      const observations = publication.geometries.flatMap((geometry) => {
        if (geometry.geometry.type !== "Point") return [];
        const [longitude, latitude] = geometry.geometry.coordinates;
        if (query.west !== undefined && longitude < query.west) return [];
        if (query.east !== undefined && longitude > query.east) return [];
        if (query.south !== undefined && latitude < query.south) return [];
        if (query.north !== undefined && latitude > query.north) return [];
        const place = publication.places.find(
          (item) => item.id === geometry.placeId,
        );
        if (!place) return [];
        const entity = entities.get(place.entityId);
        if (!entity || (entityTypeSet && !entityTypeSet.has(entity.type)))
          return [];
        return [
          {
            entityId: entity.id,
            placeId: place.id,
            geometryId: geometry.id,
            label: entity.preferredName,
            category: entity.type,
            ...(geometry.validDuring ? { temporal: geometry.validDuring } : {}),
          },
        ];
      });
      const page = paginate(observations, query);
      return page.nextCursor
        ? { observations: page.items, nextCursor: page.nextCursor }
        : { observations: page.items };
    },
    async search(query: SearchQuery): Promise<Page<SearchHit>> {
      const term = query.text.trim().toLocaleLowerCase();
      if (!term) return { items: [] };
      const workHits: SearchHit[] = publication.works
        .filter((item) =>
          `${item.title} ${item.alternativeTitles.join(" ")}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .map((work) => ({ kind: "work", score: 1, work }));
      const passageHits: SearchHit[] = publication.passages
        .filter((item) =>
          Object.values(item.text).some((text) =>
            text?.toLocaleLowerCase().includes(term),
          ),
        )
        .map((passage) => ({ kind: "passage", score: 1, passage }));
      const entityHits: SearchHit[] = publication.entities
        .filter((item) =>
          `${item.preferredName} ${item.aliases.join(" ")}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .map((entity) => ({ kind: "entity", score: 1, entity }));
      return paginate([...workHits, ...entityHits, ...passageHits], query);
    },
  };

  return {
    catalog: repository,
    reader: repository,
    knowledge: repository,
    atlas: repository,
    search: repository,
  };
}

export function createEmptyPublication(): KnowledgePublication {
  return {
    manifest: {
      contractVersion: CONTRACT_VERSION,
      publicationId: "empty",
      title: "尚未接入数据",
      generatedAt: "1970-01-01T00:00:00.000Z",
      sourceDescription: "Architecture-only placeholder",
    },
    works: [],
    editions: [],
    volumes: [],
    passages: [],
    entities: [],
    mentions: [],
    assertions: [],
    places: [],
    geometries: [],
  };
}
