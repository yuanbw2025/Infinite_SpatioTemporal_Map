import type {
  Entity,
  EntityId,
  Page,
  Passage,
  PassageId,
  SearchHit,
  SearchQuery,
  Work,
  WorkId,
} from "@infinite-spacetime/contracts";
import { overlaps } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";
import { paginate } from "./query-utils";

export function search(
  index: PublicationIndex,
  query: SearchQuery,
): Page<SearchHit> {
  const term = query.text.trim().toLocaleLowerCase();
  if (!term) return { items: [] };
  const region = query.region?.trim().toLocaleLowerCase();
  const statuses = query.reviewStatuses
    ? new Set(query.reviewStatuses)
    : undefined;
  const workIsAllowed = (workId: WorkId | undefined) =>
    workId !== undefined && (!query.workIds || query.workIds.includes(workId));
  const workMatchesRegion = (work: Work | undefined) =>
    !region ||
    Boolean(
      work &&
      (work.coverage?.regionLabels ?? [])
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
    index.assertionsByPassage.get(passageId) ?? [];
  const passageMentions = (passageId: PassageId) =>
    index.mentionsByPassage.get(passageId) ?? [];
  const passageMatchesStatus = (passage: Passage) =>
    !statuses ||
    passageAssertions(passage.id).some((item) =>
      statuses.has(item.reviewStatus),
    ) ||
    passageMentions(passage.id).some((item) => statuses.has(item.reviewStatus));
  const passageMatchesTemporal = (passage: Passage) => {
    if (!query.temporal) return true;
    if (
      passageAssertions(passage.id).some((item) =>
        Boolean(item.temporal && overlaps(item.temporal, query.temporal)),
      )
    )
      return true;
    const mentionedIds = new Set(
      passageMentions(passage.id).map((item) => item.entityId),
    );
    if (
      index.publication.occurrences.some(
        (item) =>
          mentionedIds.has(item.entityId) &&
          overlaps(item.temporal, query.temporal),
      )
    )
      return true;
    return workMatchesTemporal(
      index.works.get(index.workIdForPassage(passage)!),
    );
  };
  const entityMatchesWork = (entityId: EntityId) => {
    if (!query.workIds) return true;
    const directEvidence = (index.assertionsByEntity.get(entityId) ?? []).some(
      (assertion) =>
        assertion.evidence.some((evidence) => {
          const passage = index.passages.get(evidence.passageId);
          return Boolean(
            passage && workIsAllowed(index.workIdForPassage(passage)),
          );
        }),
    );
    return (
      directEvidence ||
      index
        .entityPassages(entityId)
        .some((passage) => workIsAllowed(index.workIdForPassage(passage)))
    );
  };
  const entityMatchesStatus = (entity: Entity) =>
    !statuses ||
    statuses.has(entity.reviewStatus) ||
    (index.mentionsByEntity.get(entity.id) ?? []).some((item) =>
      statuses.has(item.reviewStatus),
    ) ||
    (index.assertionsByEntity.get(entity.id) ?? []).some((item) =>
      statuses.has(item.reviewStatus),
    ) ||
    (index.occurrencesByEntity.get(entity.id) ?? []).some((item) =>
      statuses.has(item.reviewStatus),
    );
  const entityMatchesTemporal = (entityId: EntityId) =>
    !query.temporal ||
    (index.assertionsByEntity.get(entityId) ?? []).some((item) =>
      Boolean(item.temporal && overlaps(item.temporal, query.temporal)),
    ) ||
    (index.occurrencesByEntity.get(entityId) ?? []).some((item) =>
      Boolean(item.temporal && overlaps(item.temporal, query.temporal)),
    ) ||
    index
      .entityPassages(entityId)
      .some((passage) =>
        workMatchesTemporal(index.works.get(index.workIdForPassage(passage)!)),
      );
  const entityMatchesRegion = (entity: Entity) => {
    if (!region) return true;
    const ownPlace = index.publication.places.find(
      (place) => place.entityId === entity.id,
    );
    if (
      ownPlace &&
      [
        index.placeLabel(ownPlace),
        ...ownPlace.historicalNames.map((item) => item.name),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(region)
    )
      return true;
    if (
      (index.occurrencesByEntity.get(entity.id) ?? []).some((occurrence) => {
        const place = index.places.get(occurrence.placeId);
        return Boolean(
          place &&
          [
            index.placeLabel(place),
            ...place.historicalNames.map((item) => item.name),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(region),
        );
      })
    )
      return true;
    return index
      .entityPassages(entity.id)
      .some((passage) =>
        workMatchesRegion(index.works.get(index.workIdForPassage(passage)!)),
      );
  };
  const workHits: SearchHit[] = index.publication.works
    .filter((item) => workIsAllowed(item.id))
    .filter(workMatchesRegion)
    .filter(workMatchesTemporal)
    .filter((item) =>
      `${item.title} ${item.alternativeTitles.join(" ")}`
        .toLocaleLowerCase()
        .includes(term),
    )
    .map((work) => ({ kind: "work", score: 1, work }));
  const passageHits: SearchHit[] = index.publication.passages
    .filter((item) => workIsAllowed(index.workIdForPassage(item)))
    .filter((item) =>
      workMatchesRegion(index.works.get(index.workIdForPassage(item)!)),
    )
    .filter(passageMatchesTemporal)
    .filter(passageMatchesStatus)
    .filter((item) =>
      Object.values(item.text).some((text) =>
        text?.toLocaleLowerCase().includes(term),
      ),
    )
    .map((passage) => ({ kind: "passage", score: 1, passage }));
  const entityHits: SearchHit[] = index.publication.entities
    .filter(
      (item) => !query.entityTypes || query.entityTypes.includes(item.type),
    )
    .filter((item) => entityMatchesWork(item.id))
    .filter(entityMatchesRegion)
    .filter((item) => entityMatchesTemporal(item.id))
    .filter(entityMatchesStatus)
    .filter((item) =>
      `${item.preferredName} ${item.aliases.join(" ")}`
        .toLocaleLowerCase()
        .includes(term),
    )
    .map((entity) => ({ kind: "entity", score: 1, entity }));
  return paginate([...workHits, ...entityHits, ...passageHits], query);
}
