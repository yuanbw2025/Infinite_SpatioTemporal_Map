import type {
  EntityId,
  EntityProfile,
  EntityQuery,
  EntitySummary,
  Page,
} from "@infinite-spacetime/contracts";
import { NotFoundError } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";
import { paginate } from "./query-utils";

export function listEntities(
  index: PublicationIndex,
  query: EntityQuery = {},
): Page<EntitySummary> {
  const term = query.text?.trim().toLocaleLowerCase();
  const types = query.types ? new Set(query.types) : undefined;
  const statuses = query.reviewStatuses
    ? new Set(query.reviewStatuses)
    : undefined;
  const items = index.publication.entities
    .filter((entity) => !types || types.has(entity.type))
    .filter((entity) => !statuses || statuses.has(entity.reviewStatus))
    .filter(
      (entity) =>
        !term ||
        `${entity.preferredName} ${entity.aliases.join(" ")}`
          .toLocaleLowerCase()
          .includes(term),
    )
    .map((entity) => ({
      entity,
      mentionCount: index.mentionsByEntity.get(entity.id)?.length ?? 0,
      assertionCount: index.assertionsByEntity.get(entity.id)?.length ?? 0,
      occurrenceCount: index.occurrencesByEntity.get(entity.id)?.length ?? 0,
    }));
  return paginate(items, query);
}

export function openEntity(
  index: PublicationIndex,
  id: EntityId,
): EntityProfile {
  const entity = index.entities.get(id);
  if (!entity) throw new NotFoundError("Entity", id);
  const assertions = index.assertionsByEntity.get(id) ?? [];
  const mentions = index.mentionsByEntity.get(id) ?? [];
  const occurrences = index.occurrencesByEntity.get(id) ?? [];
  const passageIds = new Set(mentions.map((item) => item.passageId));
  const relatedEntityIds = new Set<EntityId>();
  for (const assertion of assertions) {
    for (const evidence of assertion.evidence)
      passageIds.add(evidence.passageId);
    if (assertion.subjectId !== id) relatedEntityIds.add(assertion.subjectId);
    if (assertion.objectId && assertion.objectId !== id)
      relatedEntityIds.add(assertion.objectId);
  }
  for (const occurrence of occurrences) {
    for (const evidence of occurrence.evidence)
      passageIds.add(evidence.passageId);
    const placeEntityId = index.places.get(occurrence.placeId)?.entityId;
    if (placeEntityId && placeEntityId !== id)
      relatedEntityIds.add(placeEntityId);
  }
  const occurrencePlaceIds = [
    ...new Set(occurrences.map((item) => item.placeId)),
  ];
  return {
    entity,
    assertions,
    mentions,
    passageIds: [...passageIds],
    relatedEntityIds: [...relatedEntityIds],
    relatedEntities: [...relatedEntityIds].flatMap((entityId) => {
      const related = index.entities.get(entityId);
      return related ? [related] : [];
    }),
    occurrences,
    occurrencePlaces: occurrencePlaceIds.flatMap((placeId) => {
      const place = index.places.get(placeId);
      return place ? [place] : [];
    }),
    occurrencePlaceEntities: occurrencePlaceIds.flatMap((placeId) => {
      const place = index.places.get(placeId);
      const placeEntity = place
        ? index.entities.get(place.entityId)
        : undefined;
      return placeEntity ? [placeEntity] : [];
    }),
  };
}
