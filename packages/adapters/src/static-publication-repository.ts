import {
  CONTRACT_VERSION,
  type Assertion,
  type AtlasQuery,
  type AtlasResult,
  type DatasetOverview,
  type DataContext,
  type Edition,
  type EditionId,
  type Entity,
  type EntityId,
  type EntityProfile,
  type EntityQuery,
  type EntitySummary,
  type EvidenceSpan,
  type HistoricalGeometry,
  type KnowledgeGraphQuery,
  type KnowledgeGraphResult,
  type KnowledgePublication,
  type Page,
  type Passage,
  type PassageContext,
  type PassageId,
  type PassageQuery,
  type PlaceIdentity,
  type ResearchFinding,
  type ResearchFindingKind,
  type ResearchQuery,
  type ResearchReport,
  type SearchHit,
  type SearchQuery,
  type SourceId,
  type TimelineItem,
  type TimelineQuery,
  type TimelineResult,
  type Volume,
  type Work,
  type WorkId,
  type WorkQuery,
} from "@infinite-spacetime/contracts";
import type {
  AtlasRepository,
  CatalogRepository,
  KnowledgeGraphRepository,
  KnowledgeRepository,
  MetadataRepository,
  ReaderRepository,
  RepositoryBundle,
  ResearchRepository,
  SearchRepository,
  TimelineRepository,
} from "@infinite-spacetime/core";
import { ContractMismatchError } from "@infinite-spacetime/core";
import {
  boundedLimit,
  groupBy,
  historicalNameAt,
  intersectsBounds,
  overlaps,
  overlapsYears,
  paginate,
} from "./static-query-helpers";

type StaticRepository = CatalogRepository &
  ReaderRepository &
  KnowledgeRepository &
  AtlasRepository &
  SearchRepository &
  MetadataRepository &
  KnowledgeGraphRepository &
  TimelineRepository &
  ResearchRepository;

export function createStaticPublicationRepository(
  publication: KnowledgePublication,
): RepositoryBundle {
  if (publication.manifest.contractVersion !== CONTRACT_VERSION) {
    throw new ContractMismatchError(
      `Expected contract ${CONTRACT_VERSION}, received ${publication.manifest.contractVersion}`,
    );
  }

  const works = new Map(publication.works.map((item) => [item.id, item]));
  const sources = new Map(publication.sources.map((item) => [item.id, item]));
  const passages = new Map(publication.passages.map((item) => [item.id, item]));
  const entities = new Map(publication.entities.map((item) => [item.id, item]));
  const editions = new Map(publication.editions.map((item) => [item.id, item]));
  const volumes = new Map(publication.volumes.map((item) => [item.id, item]));
  const places = new Map(publication.places.map((item) => [item.id, item]));
  const editionIdForPassage = (passage: Passage) =>
    volumes.get(passage.volumeId)?.editionId;
  const workIdForPassage = (passage: Passage) => {
    const editionId = editionIdForPassage(passage);
    return editionId ? editions.get(editionId)?.workId : undefined;
  };
  const placeLabel = (place: PlaceIdentity) =>
    entities.get(place.entityId)?.preferredName ??
    place.historicalNames[0]?.name ??
    place.id;
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
  const passagesByWork = groupBy(publication.passages, (item) =>
    workIdForPassage(item),
  );
  const passagesByEdition = groupBy(publication.passages, (item) =>
    editionIdForPassage(item),
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
            `${work.coverage?.regionLabels.join(" ") ?? ""}`
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
    async listSources(sourceIds: readonly SourceId[]) {
      return sourceIds.flatMap((sourceId) => {
        const source = sources.get(sourceId);
        return source ? [source] : [];
      });
    },
    async getPassage(id: PassageId): Promise<Passage | null> {
      return passages.get(id) ?? null;
    },
    async getPassageContext(id: PassageId): Promise<PassageContext | null> {
      const passage = passages.get(id);
      if (!passage) return null;
      const volume = volumes.get(passage.volumeId);
      const edition = volume ? editions.get(volume.editionId) : undefined;
      const work = edition ? works.get(edition.workId) : undefined;
      if (!volume || !edition || !work) return null;
      const siblings = [
        ...(passagesByEdition.get(editionIdForPassage(passage)) ?? []),
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
        work,
        edition,
        volume,
        facsimiles: passage.facsimileAnchors.flatMap((anchor) => {
          const page = publication.facsimilePages.find(
            (candidate) => candidate.id === anchor.pageId,
          );
          return page ? [{ anchor, page }] : [];
        }),
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
              editionIdForPassage(item) === query.editionId,
          )
          .filter(
            (item) =>
              query.volumeId === undefined || item.volumeId === query.volumeId,
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
        occurrencePlaceEntities: [
          ...new Set(occurrences.map((item) => item.placeId)),
        ].flatMap((placeId) => {
          const place = places.get(placeId);
          const placeEntity = place ? entities.get(place.entityId) : undefined;
          return placeEntity ? [placeEntity] : [];
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
            label: historicalNameAt(
              place,
              query.temporal,
              entity.preferredName,
            ),
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
      const region = query.region?.trim().toLocaleLowerCase();
      const reviewStatuses = query.reviewStatuses
        ? new Set(query.reviewStatuses)
        : undefined;
      const workIsAllowed = (workId: WorkId | undefined) =>
        workId !== undefined &&
        (!query.workIds || query.workIds.includes(workId));
      const workMatchesRegion = (work: Work | undefined) =>
        !region ||
        Boolean(
          work &&
          [...(work.coverage?.regionLabels ?? [])]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase()
            .includes(region),
        );
      const workMatchesTemporal = (work: Work | undefined) =>
        !query.temporal ||
        Boolean(
          work?.coverage?.temporal &&
          overlaps(work.coverage.temporal, query.temporal),
        );
      const passageAssertions = (passageId: PassageId) =>
        assertionsByPassage.get(passageId) ?? [];
      const passageMentions = (passageId: PassageId) =>
        mentionsByPassage.get(passageId) ?? [];
      const passageMatchesStatus = (passage: Passage) =>
        !reviewStatuses ||
        passageAssertions(passage.id).some((item) =>
          reviewStatuses.has(item.reviewStatus),
        ) ||
        passageMentions(passage.id).some((item) =>
          reviewStatuses.has(item.reviewStatus),
        );
      const passageMatchesTemporal = (passage: Passage) => {
        if (!query.temporal) return true;
        if (
          passageAssertions(passage.id).some((item) =>
            Boolean(item.temporal && overlaps(item.temporal, query.temporal)),
          )
        ) {
          return true;
        }
        const mentionedIds = new Set(
          passageMentions(passage.id).map((item) => item.entityId),
        );
        if (
          publication.occurrences.some(
            (item) =>
              mentionedIds.has(item.entityId) &&
              overlaps(item.temporal, query.temporal),
          )
        ) {
          return true;
        }
        return workMatchesTemporal(works.get(workIdForPassage(passage)!));
      };
      const entityPassages = (entityId: EntityId) =>
        (mentionsByEntity.get(entityId) ?? [])
          .map((mention) => passages.get(mention.passageId))
          .filter((passage): passage is Passage => Boolean(passage));
      const entityMatchesWork = (entityId: EntityId) => {
        if (!query.workIds) return true;
        const directEvidence = (assertionsByEntity.get(entityId) ?? []).some(
          (assertion) =>
            assertion.evidence.some((evidence) => {
              const passage = passages.get(evidence.passageId);
              return Boolean(
                passage && workIsAllowed(workIdForPassage(passage)),
              );
            }),
        );
        return (
          directEvidence ||
          entityPassages(entityId).some((passage) =>
            workIsAllowed(workIdForPassage(passage)),
          )
        );
      };
      const entityMatchesStatus = (entity: Entity) =>
        !reviewStatuses ||
        (entity.reviewStatus !== undefined &&
          reviewStatuses.has(entity.reviewStatus)) ||
        (mentionsByEntity.get(entity.id) ?? []).some((item) =>
          reviewStatuses.has(item.reviewStatus),
        ) ||
        (assertionsByEntity.get(entity.id) ?? []).some((item) =>
          reviewStatuses.has(item.reviewStatus),
        ) ||
        (occurrencesByEntity.get(entity.id) ?? []).some((item) =>
          reviewStatuses.has(item.reviewStatus),
        );
      const entityMatchesTemporal = (entityId: EntityId) =>
        !query.temporal ||
        (assertionsByEntity.get(entityId) ?? []).some((item) =>
          Boolean(item.temporal && overlaps(item.temporal, query.temporal)),
        ) ||
        (occurrencesByEntity.get(entityId) ?? []).some((item) =>
          Boolean(item.temporal && overlaps(item.temporal, query.temporal)),
        ) ||
        entityPassages(entityId).some((passage) =>
          workMatchesTemporal(works.get(workIdForPassage(passage)!)),
        );
      const entityMatchesRegion = (entity: Entity) => {
        if (!region) return true;
        const ownPlace = publication.places.find(
          (place) => place.entityId === entity.id,
        );
        if (
          ownPlace &&
          [
            placeLabel(ownPlace),
            ...ownPlace.historicalNames.map((item) => item.name),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(region)
        ) {
          return true;
        }
        if (
          (occurrencesByEntity.get(entity.id) ?? []).some((occurrence) => {
            const place = places.get(occurrence.placeId);
            return Boolean(
              place &&
              [
                placeLabel(place),
                ...place.historicalNames.map((item) => item.name),
              ]
                .join(" ")
                .toLocaleLowerCase()
                .includes(region),
            );
          })
        ) {
          return true;
        }
        return entityPassages(entity.id).some((passage) =>
          workMatchesRegion(works.get(workIdForPassage(passage)!)),
        );
      };
      const workHits: SearchHit[] = publication.works
        .filter((item) => workIsAllowed(item.id))
        .filter((item) => workMatchesRegion(item))
        .filter((item) => workMatchesTemporal(item))
        .filter((item) =>
          `${item.title} ${item.alternativeTitles.join(" ")}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .map((work) => ({ kind: "work", score: 1, work }));
      const passageHits: SearchHit[] = publication.passages
        .filter((item) => workIsAllowed(workIdForPassage(item)))
        .filter((item) => workMatchesRegion(works.get(workIdForPassage(item)!)))
        .filter((item) => passageMatchesTemporal(item))
        .filter((item) => passageMatchesStatus(item))
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
        .filter((item) => entityMatchesWork(item.id))
        .filter((item) => entityMatchesRegion(item))
        .filter((item) => entityMatchesTemporal(item.id))
        .filter((item) => entityMatchesStatus(item))
        .filter((item) =>
          `${item.preferredName} ${item.aliases.join(" ")}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .map((entity) => ({ kind: "entity", score: 1, entity }));
      return paginate([...workHits, ...entityHits, ...passageHits], query);
    },
    async exploreGraph(
      query: KnowledgeGraphQuery = {},
    ): Promise<KnowledgeGraphResult> {
      const limit = boundedLimit(query.limit, 80, 200);
      const depth = boundedLimit(query.depth, 1, 3);
      const typeSet = query.entityTypes
        ? new Set(query.entityTypes)
        : undefined;
      const statusSet = query.reviewStatuses
        ? new Set(query.reviewStatuses)
        : undefined;
      const relations = publication.assertions.filter(
        (assertion) =>
          assertion.objectId !== undefined &&
          (!statusSet || statusSet.has(assertion.reviewStatus)),
      );
      const degree = new Map<EntityId, number>();
      for (const assertion of relations) {
        degree.set(
          assertion.subjectId,
          (degree.get(assertion.subjectId) ?? 0) + 1,
        );
        if (assertion.objectId) {
          degree.set(
            assertion.objectId,
            (degree.get(assertion.objectId) ?? 0) + 1,
          );
        }
      }
      const accepts = (entityId: EntityId) => {
        const entity = entities.get(entityId);
        return Boolean(
          entity &&
          (!typeSet ||
            typeSet.has(entity.type) ||
            entityId === query.centerEntityId),
        );
      };
      const selectedIds = new Set<EntityId>();
      let truncated = false;

      if (query.centerEntityId && entities.has(query.centerEntityId)) {
        selectedIds.add(query.centerEntityId);
        let frontier = new Set<EntityId>([query.centerEntityId]);
        for (let level = 0; level < depth && frontier.size; level += 1) {
          const next = new Set<EntityId>();
          for (const assertion of relations) {
            const objectId = assertion.objectId;
            if (!objectId) continue;
            const touchesSubject = frontier.has(assertion.subjectId);
            const touchesObject = frontier.has(objectId);
            if (!touchesSubject && !touchesObject) continue;
            const candidateId = touchesSubject ? objectId : assertion.subjectId;
            if (!accepts(candidateId) || selectedIds.has(candidateId)) continue;
            if (selectedIds.size >= limit) {
              truncated = true;
              continue;
            }
            selectedIds.add(candidateId);
            next.add(candidateId);
          }
          frontier = next;
        }
      } else {
        const ranked = publication.entities
          .filter((entity) => accepts(entity.id))
          .toSorted((left, right) => {
            const score = (entityId: EntityId) =>
              (degree.get(entityId) ?? 0) * 4 +
              (mentionsByEntity.get(entityId)?.length ?? 0) +
              (occurrencesByEntity.get(entityId)?.length ?? 0) * 2;
            return score(right.id) - score(left.id);
          });
        for (const entity of ranked.slice(0, limit)) selectedIds.add(entity.id);
        truncated = ranked.length > limit;
      }

      const nodes = [...selectedIds].flatMap((entityId) => {
        const entity = entities.get(entityId);
        if (!entity) return [];
        return [
          {
            entity,
            mentionCount: mentionsByEntity.get(entityId)?.length ?? 0,
            assertionCount: assertionsByEntity.get(entityId)?.length ?? 0,
            occurrenceCount: occurrencesByEntity.get(entityId)?.length ?? 0,
          },
        ];
      });
      const edges = relations.flatMap((assertion) => {
        if (
          !assertion.objectId ||
          !selectedIds.has(assertion.subjectId) ||
          !selectedIds.has(assertion.objectId)
        ) {
          return [];
        }
        return [
          {
            assertionId: assertion.id,
            sourceId: assertion.subjectId,
            targetId: assertion.objectId,
            predicate: assertion.predicate,
            ...(assertion.temporal ? { temporal: assertion.temporal } : {}),
            evidence: assertion.evidence,
            reviewStatus: assertion.reviewStatus,
          },
        ];
      });
      return { nodes, edges, truncated };
    },
    async buildTimeline(query: TimelineQuery = {}): Promise<TimelineResult> {
      const limit = boundedLimit(query.limit, 500, 2_000);
      const entityIdSet = query.entityIds
        ? new Set(query.entityIds)
        : undefined;
      const entityTypeSet = query.entityTypes
        ? new Set(query.entityTypes)
        : undefined;
      const workIdSet = query.workIds ? new Set(query.workIds) : undefined;
      const acceptsEntity = (entityId: EntityId) => {
        const entity = entities.get(entityId);
        return Boolean(
          entity &&
          (!entityIdSet || entityIdSet.has(entityId)) &&
          (!entityTypeSet || entityTypeSet.has(entity.type)),
        );
      };
      const acceptsEvidence = (evidence: readonly EvidenceSpan[]) =>
        !workIdSet ||
        evidence.some((span) => {
          const passage = passages.get(span.passageId);
          const workId = passage ? workIdForPassage(passage) : undefined;
          return workId !== undefined && workIdSet.has(workId);
        });

      const allItems: TimelineItem[] = [];
      let undatedCount = 0;
      for (const occurrence of publication.occurrences) {
        if (!acceptsEntity(occurrence.entityId)) continue;
        if (!acceptsEvidence(occurrence.evidence)) continue;
        if (!occurrence.temporal) {
          undatedCount += 1;
          continue;
        }
        if (
          !overlapsYears(occurrence.temporal, query.startYear, query.endYear)
        ) {
          continue;
        }
        allItems.push({
          id: occurrence.id,
          kind: "occurrence",
          entityId: occurrence.entityId,
          label: occurrence.label ?? occurrence.kind,
          temporal: occurrence.temporal,
          placeId: occurrence.placeId,
          evidence: occurrence.evidence,
          reviewStatus: occurrence.reviewStatus,
        });
      }
      for (const assertion of publication.assertions) {
        if (!acceptsEntity(assertion.subjectId)) continue;
        if (!acceptsEvidence(assertion.evidence)) continue;
        if (!assertion.temporal) {
          undatedCount += 1;
          continue;
        }
        if (
          !overlapsYears(assertion.temporal, query.startYear, query.endYear)
        ) {
          continue;
        }
        const objectLabel = assertion.objectId
          ? entities.get(assertion.objectId)?.preferredName
          : assertion.literalValue;
        allItems.push({
          id: assertion.id,
          kind: "assertion",
          entityId: assertion.subjectId,
          label: [assertion.predicate, objectLabel].filter(Boolean).join("："),
          temporal: assertion.temporal,
          predicate: assertion.predicate,
          evidence: assertion.evidence,
          reviewStatus: assertion.reviewStatus,
        });
      }

      const sortedItems = allItems.toSorted(
        (left, right) =>
          (left.temporal.startYear ?? left.temporal.endYear ?? 0) -
          (right.temporal.startYear ?? right.temporal.endYear ?? 0),
      );
      const limitedItems = sortedItems.slice(0, limit);
      const itemsByEntity = groupBy(limitedItems, (item) => item.entityId);
      const tracks = [...itemsByEntity.entries()].flatMap(
        ([entityId, items]) => {
          const entity = entities.get(entityId);
          return entity ? [{ entity, items }] : [];
        },
      );
      const numericYears = limitedItems.flatMap((item) => [
        ...(item.temporal.startYear !== undefined
          ? [item.temporal.startYear]
          : []),
        ...(item.temporal.endYear !== undefined ? [item.temporal.endYear] : []),
      ]);
      const range = numericYears.length
        ? {
            startYear: Math.min(...numericYears),
            endYear: Math.max(...numericYears),
          }
        : undefined;
      return {
        tracks,
        ...(range ? { range } : {}),
        undatedCount,
        truncated: sortedItems.length > limit,
      };
    },
    async inspectResearch(query: ResearchQuery = {}): Promise<ResearchReport> {
      const limit = boundedLimit(query.limit, 200, 1_000);
      const entityIdSet = query.entityIds
        ? new Set(query.entityIds)
        : undefined;
      const workIdSet = query.workIds ? new Set(query.workIds) : undefined;
      const kindSet = query.kinds ? new Set(query.kinds) : undefined;
      const acceptsEntity = (entityId: EntityId) =>
        !entityIdSet || entityIdSet.has(entityId);
      const passageIdsFor = (evidence: readonly EvidenceSpan[]) => [
        ...new Set(evidence.map((span) => span.passageId)),
      ];
      const acceptsEvidence = (evidence: readonly EvidenceSpan[]) =>
        !workIdSet ||
        evidence.some((span) => {
          const passage = passages.get(span.passageId);
          const workId = passage ? workIdForPassage(passage) : undefined;
          return workId !== undefined && workIdSet.has(workId);
        });
      const findings: ResearchFinding[] = [];
      const pushFinding = (finding: ResearchFinding) => {
        if (!kindSet || kindSet.has(finding.kind)) findings.push(finding);
      };

      const assertionGroups = groupBy(
        publication.assertions.filter(
          (assertion) =>
            acceptsEntity(assertion.subjectId) &&
            acceptsEvidence(assertion.evidence),
        ),
        (assertion) => `${assertion.subjectId}\u0000${assertion.predicate}`,
      );
      for (const assertions of assertionGroups.values()) {
        const valueOf = (assertion: Assertion) =>
          assertion.objectId ?? assertion.literalValue ?? "";
        const conflicting = assertions.filter((assertion, index) =>
          assertions.some(
            (candidate, candidateIndex) =>
              candidateIndex !== index &&
              valueOf(candidate) !== valueOf(assertion) &&
              overlaps(assertion.temporal, candidate.temporal),
          ),
        );
        if (conflicting.length <= 1) continue;
        const values = new Set(conflicting.map(valueOf));
        const first = conflicting[0]!;
        const subject = entities.get(first.subjectId);
        const evidence = conflicting.flatMap((assertion) => assertion.evidence);
        pushFinding({
          id: `contradiction:${first.subjectId}:${first.predicate}`,
          kind: "contradictory_assertions",
          severity: "warning",
          title: `${subject?.preferredName ?? "实体"}的“${first.predicate}”存在不同记载`,
          description: `当前发布包保留了 ${values.size} 个不同值，应回到各自原文核验，不自动合并。`,
          entityIds: [first.subjectId],
          assertionIds: conflicting.map((assertion) => assertion.id),
          passageIds: passageIdsFor(evidence),
        });
      }

      for (const assertion of publication.assertions) {
        if (
          assertion.reviewStatus !== "disputed" ||
          !acceptsEntity(assertion.subjectId) ||
          !acceptsEvidence(assertion.evidence)
        ) {
          continue;
        }
        pushFinding({
          id: `disputed:${assertion.id}`,
          kind: "disputed_record",
          severity: "notice",
          title: `争议主张：${entities.get(assertion.subjectId)?.preferredName ?? assertion.subjectId}`,
          description: `“${assertion.predicate}”已标记为争议，系统保留原始证据供并列考察。`,
          entityIds: [assertion.subjectId],
          assertionIds: [assertion.id],
          passageIds: passageIdsFor(assertion.evidence),
        });
      }

      const unresolved = new Set<string>();
      for (const occurrence of publication.occurrences) {
        if (!acceptsEntity(occurrence.entityId)) continue;
        if (!acceptsEvidence(occurrence.evidence)) continue;
        if ((geometriesByPlace.get(occurrence.placeId) ?? []).length) continue;
        const key = `${occurrence.entityId}:${occurrence.placeId}`;
        if (unresolved.has(key)) continue;
        unresolved.add(key);
        pushFinding({
          id: `geometry:${key}`,
          kind: "unresolved_geometry",
          severity: "notice",
          title: `${entities.get(occurrence.entityId)?.preferredName ?? "实体"}的时空记录尚未定位`,
          description: `地点“${places.get(occurrence.placeId) ? placeLabel(places.get(occurrence.placeId)!) : occurrence.placeId}”尚无经过审核的历史几何；原始地名会继续保留。`,
          entityIds: [occurrence.entityId],
          assertionIds: [],
          passageIds: passageIdsFor(occurrence.evidence),
        });
      }

      for (const [
        entityId,
        entityOccurrences,
      ] of occurrencesByEntity.entries()) {
        if (!acceptsEntity(entityId)) continue;
        const sequenced = entityOccurrences
          .filter(
            (item) =>
              item.sequence !== undefined &&
              item.temporal?.startYear !== undefined,
          )
          .toSorted((left, right) => left.sequence! - right.sequence!);
        for (let index = 1; index < sequenced.length; index += 1) {
          const previous = sequenced[index - 1]!;
          const current = sequenced[index]!;
          if (current.temporal!.startYear! >= previous.temporal!.startYear!) {
            continue;
          }
          const evidence = [...previous.evidence, ...current.evidence];
          pushFinding({
            id: `chronology:${entityId}:${previous.id}:${current.id}`,
            kind: "chronology_conflict",
            severity: "critical",
            title: `${entities.get(entityId)?.preferredName ?? "实体"}的行迹次序与年代冲突`,
            description:
              "记录的 sequence 顺序与公元纪年倒置，需要核对纪年换算或事件排序。",
            entityIds: [entityId],
            assertionIds: [],
            passageIds: passageIdsFor(evidence),
          });
        }
      }

      const counts: Record<ResearchFindingKind, number> = {
        contradictory_assertions: 0,
        disputed_record: 0,
        unresolved_geometry: 0,
        chronology_conflict: 0,
      };
      for (const finding of findings) counts[finding.kind] += 1;
      return {
        findings: findings.slice(0, limit),
        counts,
        truncated: findings.length > limit,
      };
    },
    async getDatasetOverview(): Promise<DatasetOverview> {
      const reviewCounts = {
        raw: 0,
        machine_suggested: 0,
        reviewed: 0,
        verified: 0,
        disputed: 0,
        rejected: 0,
      };
      for (const status of [
        ...publication.entities.map((item) => item.reviewStatus),
        ...publication.mentions.map((item) => item.reviewStatus),
        ...publication.assertions.map((item) => item.reviewStatus),
        ...publication.geometries.map((item) => item.reviewStatus),
        ...publication.occurrences.map((item) => item.reviewStatus),
      ]) {
        if (status) reviewCounts[status] += 1;
      }
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
        quality: {
          reviewCounts,
          coverage: {
            facsimilePassages: publication.passages.filter(
              (item) => item.facsimileAnchors.length > 0,
            ).length,
            simplifiedPassages: publication.passages.filter(
              (item) => item.text.simplified,
            ).length,
            translatedPassages: publication.passages.filter(
              (item) => item.text.modernTranslation,
            ).length,
            evidencedAssertions: publication.assertions.filter(
              (item) => item.evidence.length,
            ).length,
            datedAssertions: publication.assertions.filter(
              (item) => item.temporal,
            ).length,
            locatedPlaces: new Set(
              publication.geometries.map((item) => item.placeId),
            ).size,
            datedOccurrences: publication.occurrences.filter(
              (item) => item.temporal,
            ).length,
          },
        },
      };
    },
  };

  return {
    dataContext: Object.freeze({
      contractVersion: publication.manifest.contractVersion,
      publicationId: publication.manifest.publicationId,
      datasetVersion: publication.manifest.datasetVersion,
      contentChecksum: publication.manifest.contentChecksum,
    }) satisfies DataContext,
    catalog: repository,
    reader: repository,
    knowledge: repository,
    atlas: repository,
    search: repository,
    metadata: repository,
    graph: repository,
    timeline: repository,
    research: repository,
  };
}
