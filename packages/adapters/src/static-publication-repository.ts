import {
  CONTRACT_VERSION,
  type Assertion,
  type AtlasQuery,
  type AtlasResult,
  type DatasetOverview,
  type Edition,
  type EditionId,
  type Entity,
  type EntityId,
  type EntityProfile,
  type EntityQuery,
  type EntitySummary,
  type HistoricalGeometry,
  type KnowledgePublication,
  type Page,
  type PageRequest,
  type Passage,
  type PassageContext,
  type PassageId,
  type PassageQuery,
  type SearchHit,
  type SearchQuery,
  type Volume,
  type Work,
  type WorkId,
  type WorkQuery,
} from "@infinite-spacetime/contracts";
import type {
  AtlasRepository,
  CatalogRepository,
  KnowledgeRepository,
  MetadataRepository,
  ReaderRepository,
  RepositoryBundle,
  SearchRepository,
} from "@infinite-spacetime/core";
import { ContractMismatchError } from "@infinite-spacetime/core";

type StaticRepository = CatalogRepository &
  ReaderRepository &
  KnowledgeRepository &
  AtlasRepository &
  SearchRepository &
  MetadataRepository;

function paginate<T>(items: readonly T[], request: PageRequest = {}): Page<T> {
  const start = Number.parseInt(request.cursor ?? "0", 10) || 0;
  const limit = Math.min(Math.max(request.limit ?? 50, 1), 200);
  const pageItems = items.slice(start, start + limit);
  const next = start + pageItems.length;
  return next < items.length
    ? { items: pageItems, nextCursor: String(next) }
    : { items: pageItems };
}

function groupBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, readonly T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function overlaps(
  candidate:
    { readonly startYear?: number; readonly endYear?: number } | undefined,
  requested:
    { readonly startYear?: number; readonly endYear?: number } | undefined,
): boolean {
  if (!requested || !candidate) return true;
  const candidateStart = candidate.startYear ?? candidate.endYear;
  const candidateEnd = candidate.endYear ?? candidate.startYear;
  const requestedStart = requested.startYear ?? requested.endYear;
  const requestedEnd = requested.endYear ?? requested.startYear;
  if (
    candidateStart === undefined ||
    candidateEnd === undefined ||
    requestedStart === undefined ||
    requestedEnd === undefined
  ) {
    return true;
  }
  return candidateEnd >= requestedStart && candidateStart <= requestedEnd;
}

function intersectsBounds(
  historicalGeometry: HistoricalGeometry,
  query: AtlasQuery,
): boolean {
  const shape = historicalGeometry.geometry;
  const positions =
    shape.type === "Point"
      ? [shape.coordinates]
      : shape.type === "Polygon"
        ? shape.coordinates.flatMap((ring) => ring)
        : shape.coordinates.flatMap((polygon) =>
            polygon.flatMap((ring) => ring),
          );
  if (!positions.length) return false;
  const longitudes = positions.map((position) => position[0]);
  const latitudes = positions.map((position) => position[1]);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  if (query.west !== undefined && east < query.west) return false;
  if (query.east !== undefined && west > query.east) return false;
  if (query.south !== undefined && north < query.south) return false;
  if (query.north !== undefined && south > query.north) return false;
  return true;
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
  const editions = new Map(publication.editions.map((item) => [item.id, item]));
  const places = new Map(publication.places.map((item) => [item.id, item]));
  const geometriesByPlace = groupBy(
    publication.geometries,
    (item) => item.placeId,
  );
  const occurrencesByEntity = groupBy(
    publication.occurrences,
    (item) => item.entityId,
  );
  const editionsByWork = groupBy(publication.editions, (item) => item.workId);
  const volumesByEdition = groupBy(
    publication.volumes,
    (item) => item.editionId,
  );
  const passagesByWork = groupBy(
    publication.passages,
    (item) => item.source.workId,
  );
  const passagesByEdition = groupBy(
    publication.passages,
    (item) => item.source.editionId,
  );
  const mentionsByPassage = groupBy(
    publication.mentions,
    (item) => item.passageId,
  );
  const mentionsByEntity = groupBy(
    publication.mentions,
    (item) => item.entityId,
  );
  const assertionsByEntity = new Map<EntityId, Assertion[]>();
  const assertionsByPassage = new Map<PassageId, Assertion[]>();
  for (const assertion of publication.assertions) {
    const subjectAssertions = assertionsByEntity.get(assertion.subjectId) ?? [];
    subjectAssertions.push(assertion);
    assertionsByEntity.set(assertion.subjectId, subjectAssertions);
    if (assertion.objectId && assertion.objectId !== assertion.subjectId) {
      const objectAssertions = assertionsByEntity.get(assertion.objectId) ?? [];
      objectAssertions.push(assertion);
      assertionsByEntity.set(assertion.objectId, objectAssertions);
    }
    for (const evidence of assertion.evidence) {
      const evidenceAssertions =
        assertionsByPassage.get(evidence.passageId) ?? [];
      if (!evidenceAssertions.includes(assertion))
        evidenceAssertions.push(assertion);
      assertionsByPassage.set(evidence.passageId, evidenceAssertions);
    }
  }

  const repository: StaticRepository = {
    async listWorks(query: WorkQuery = {}) {
      const term = query.text?.trim().toLocaleLowerCase();
      const region = query.region?.trim().toLocaleLowerCase();
      const categories = query.categories
        ? new Set(query.categories)
        : undefined;
      const items = publication.works
        .filter((work) => !categories || categories.has(work.category))
        .filter(
          (work) =>
            !term ||
            `${work.title} ${work.alternativeTitles.join(" ")} ${work.abstract ?? ""}`
              .toLocaleLowerCase()
              .includes(term),
        )
        .filter(
          (work) =>
            !region ||
            `${work.describedRegion ?? ""} ${work.coverage?.regionLabels.join(" ") ?? ""}`
              .toLocaleLowerCase()
              .includes(region),
        )
        .filter((work) => overlaps(work.coverage?.temporal, query.temporal));
      return paginate(items, query);
    },
    async getWork(id: WorkId): Promise<Work | null> {
      return works.get(id) ?? null;
    },
    async listEditions(workId: WorkId): Promise<readonly Edition[]> {
      return editionsByWork.get(workId) ?? [];
    },
    async listVolumes(editionId: EditionId): Promise<readonly Volume[]> {
      return volumesByEdition.get(editionId) ?? [];
    },
    async getPassage(id: PassageId): Promise<Passage | null> {
      return passages.get(id) ?? null;
    },
    async getPassageContext(id: PassageId): Promise<PassageContext | null> {
      const passage = passages.get(id);
      if (!passage) return null;
      const siblings = [
        ...(passagesByEdition.get(passage.source.editionId) ?? []),
      ].toSorted((left, right) => left.sequence - right.sequence);
      const index = siblings.findIndex((item) => item.id === id);
      const mentions = mentionsByPassage.get(id) ?? [];
      const mentionedEntities = mentions.flatMap((mention) => {
        const entity = entities.get(mention.entityId);
        return entity ? [entity] : [];
      });
      const evidencedAssertions = assertionsByPassage.get(id) ?? [];
      const previousPassageId = index > 0 ? siblings[index - 1]?.id : undefined;
      const nextPassageId =
        index >= 0 && index < siblings.length - 1
          ? siblings[index + 1]?.id
          : undefined;
      return {
        passage,
        mentions,
        mentionedEntities,
        evidencedAssertions,
        ...(previousPassageId ? { previousPassageId } : {}),
        ...(nextPassageId ? { nextPassageId } : {}),
      };
    },
    async listPassages(query: PassageQuery): Promise<Page<Passage>> {
      return paginate(
        [...(passagesByWork.get(query.workId) ?? [])]
          .filter(
            (item) =>
              query.editionId === undefined ||
              item.source.editionId === query.editionId,
          )
          .filter(
            (item) =>
              query.volumeId === undefined ||
              item.source.volumeId === query.volumeId,
          )
          .toSorted((left, right) => left.sequence - right.sequence),
        query,
      );
    },
    async getEntity(id: EntityId): Promise<Entity | null> {
      return entities.get(id) ?? null;
    },
    async findAssertionsByEntity(id: EntityId): Promise<readonly Assertion[]> {
      return assertionsByEntity.get(id) ?? [];
    },
    async listEntities(query: EntityQuery = {}): Promise<Page<EntitySummary>> {
      const term = query.text?.trim().toLocaleLowerCase();
      const typeSet = query.types ? new Set(query.types) : undefined;
      const statusSet = query.reviewStatuses
        ? new Set(query.reviewStatuses)
        : undefined;
      const items = publication.entities
        .filter((entity) => !typeSet || typeSet.has(entity.type))
        .filter(
          (entity) =>
            !statusSet ||
            (entity.reviewStatus !== undefined &&
              statusSet.has(entity.reviewStatus)),
        )
        .filter(
          (entity) =>
            !term ||
            `${entity.preferredName} ${entity.aliases.join(" ")}`
              .toLocaleLowerCase()
              .includes(term),
        )
        .map((entity) => ({
          entity,
          mentionCount: mentionsByEntity.get(entity.id)?.length ?? 0,
          assertionCount: assertionsByEntity.get(entity.id)?.length ?? 0,
          occurrenceCount: occurrencesByEntity.get(entity.id)?.length ?? 0,
        }));
      return paginate(items, query);
    },
    async getEntityProfile(id: EntityId): Promise<EntityProfile | null> {
      const entity = entities.get(id);
      if (!entity) return null;
      const assertions = assertionsByEntity.get(id) ?? [];
      const mentions = mentionsByEntity.get(id) ?? [];
      const occurrences = occurrencesByEntity.get(id) ?? [];
      const passageIds = new Set(mentions.map((item) => item.passageId));
      const relatedEntityIds = new Set<EntityId>();
      for (const assertion of assertions) {
        for (const evidence of assertion.evidence) {
          passageIds.add(evidence.passageId);
        }
        if (assertion.subjectId !== id)
          relatedEntityIds.add(assertion.subjectId);
        if (assertion.objectId && assertion.objectId !== id) {
          relatedEntityIds.add(assertion.objectId);
        }
      }
      for (const occurrence of occurrences) {
        for (const evidence of occurrence.evidence) {
          passageIds.add(evidence.passageId);
        }
        const placeEntityId = places.get(occurrence.placeId)?.entityId;
        if (placeEntityId && placeEntityId !== id) {
          relatedEntityIds.add(placeEntityId);
        }
      }
      return {
        entity,
        assertions,
        mentions,
        passageIds: [...passageIds],
        relatedEntityIds: [...relatedEntityIds],
        relatedEntities: [...relatedEntityIds].flatMap((entityId) => {
          const related = entities.get(entityId);
          return related ? [related] : [];
        }),
        occurrences,
        occurrencePlaces: [
          ...new Set(occurrences.map((item) => item.placeId)),
        ].flatMap((placeId) => {
          const place = places.get(placeId);
          return place ? [place] : [];
        }),
      };
    },
    async exploreAtlas(query: AtlasQuery): Promise<AtlasResult> {
      const entityTypeSet = query.entityTypes
        ? new Set(query.entityTypes)
        : undefined;
      const inBounds = (geometry: HistoricalGeometry) =>
        overlaps(geometry.validDuring, query.temporal) &&
        intersectsBounds(geometry, query);
      const placeObservations = publication.geometries.flatMap((geometry) => {
        if (!inBounds(geometry)) return [];
        const place = places.get(geometry.placeId);
        if (!place) return [];
        const entity = entities.get(place.entityId);
        if (!entity || (entityTypeSet && !entityTypeSet.has(entity.type)))
          return [];
        if (query.entityIds && !query.entityIds.includes(entity.id)) return [];
        return [
          {
            entityId: entity.id,
            placeId: place.id,
            geometryId: geometry.id,
            geometry: geometry.geometry,
            label: entity.preferredName,
            category: entity.type,
            ...(geometry.validDuring ? { temporal: geometry.validDuring } : {}),
          },
        ];
      });
      const occurrenceObservations = publication.occurrences.flatMap(
        (occurrence) => {
          if (!overlaps(occurrence.temporal, query.temporal)) return [];
          const entity = entities.get(occurrence.entityId);
          if (!entity || (entityTypeSet && !entityTypeSet.has(entity.type))) {
            return [];
          }
          if (query.entityIds && !query.entityIds.includes(entity.id))
            return [];
          return (geometriesByPlace.get(occurrence.placeId) ?? []).flatMap(
            (geometry) => {
              if (!inBounds(geometry)) return [];
              return [
                {
                  entityId: entity.id,
                  placeId: occurrence.placeId,
                  geometryId: geometry.id,
                  occurrenceId: occurrence.id,
                  geometry: geometry.geometry,
                  label: occurrence.label ?? entity.preferredName,
                  category: entity.type,
                  ...(occurrence.temporal
                    ? { temporal: occurrence.temporal }
                    : geometry.validDuring
                      ? { temporal: geometry.validDuring }
                      : {}),
                },
              ];
            },
          );
        },
      );
      const observations = [...placeObservations, ...occurrenceObservations];
      const page = paginate(observations, query);
      return page.nextCursor
        ? { observations: page.items, nextCursor: page.nextCursor }
        : { observations: page.items };
    },
    async search(query: SearchQuery): Promise<Page<SearchHit>> {
      const term = query.text.trim().toLocaleLowerCase();
      if (!term) return { items: [] };
      const workHits: SearchHit[] = publication.works
        .filter((item) => !query.workIds || query.workIds.includes(item.id))
        .filter((item) =>
          `${item.title} ${item.alternativeTitles.join(" ")}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .map((work) => ({ kind: "work", score: 1, work }));
      const passageHits: SearchHit[] = publication.passages
        .filter(
          (item) =>
            !query.workIds || query.workIds.includes(item.source.workId),
        )
        .filter((item) =>
          Object.values(item.text).some((text) =>
            text?.toLocaleLowerCase().includes(term),
          ),
        )
        .map((passage) => ({ kind: "passage", score: 1, passage }));
      const entityHits: SearchHit[] = publication.entities
        .filter(
          (item) => !query.entityTypes || query.entityTypes.includes(item.type),
        )
        .filter((item) =>
          `${item.preferredName} ${item.aliases.join(" ")}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .map((entity) => ({ kind: "entity", score: 1, entity }));
      return paginate([...workHits, ...entityHits, ...passageHits], query);
    },
    async getDatasetOverview(): Promise<DatasetOverview> {
      return {
        manifest: publication.manifest,
        counts: {
          works: works.size,
          editions: editions.size,
          volumes: publication.volumes.length,
          passages: passages.size,
          entities: entities.size,
          mentions: publication.mentions.length,
          assertions: publication.assertions.length,
          places: places.size,
          geometries: publication.geometries.length,
          occurrences: publication.occurrences.length,
        },
      };
    },
  };

  return {
    catalog: repository,
    reader: repository,
    knowledge: repository,
    atlas: repository,
    search: repository,
    metadata: repository,
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
    occurrences: [],
  };
}
