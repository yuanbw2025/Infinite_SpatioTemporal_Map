import type {
  EntityId,
  KnowledgeGraphQuery,
  KnowledgeGraphResult,
} from "@infinite-spacetime/contracts";
import type { PublicationIndex } from "./publication-index";
import { boundedLimit } from "./query-utils";

export function exploreGraph(
  index: PublicationIndex,
  query: KnowledgeGraphQuery = {},
): KnowledgeGraphResult {
  const limit = boundedLimit(query.limit, 80, 200);
  const depth = boundedLimit(query.depth, 1, 3);
  const types = query.entityTypes ? new Set(query.entityTypes) : undefined;
  const statuses = query.reviewStatuses
    ? new Set(query.reviewStatuses)
    : undefined;
  const relations = index.publication.assertions.filter(
    (assertion) =>
      assertion.objectId !== undefined &&
      (!statuses || statuses.has(assertion.reviewStatus)),
  );
  const degree = new Map<EntityId, number>();
  for (const assertion of relations) {
    degree.set(assertion.subjectId, (degree.get(assertion.subjectId) ?? 0) + 1);
    if (assertion.objectId)
      degree.set(assertion.objectId, (degree.get(assertion.objectId) ?? 0) + 1);
  }
  const accepts = (entityId: EntityId) => {
    const entity = index.entities.get(entityId);
    return Boolean(
      entity &&
      (!types || types.has(entity.type) || entityId === query.centerEntityId),
    );
  };
  const selectedIds = new Set<EntityId>();
  let truncated = false;
  if (query.centerEntityId && index.entities.has(query.centerEntityId)) {
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
    const ranked = index.publication.entities
      .filter((entity) => accepts(entity.id))
      .toSorted((left, right) => {
        const score = (entityId: EntityId) =>
          (degree.get(entityId) ?? 0) * 4 +
          (index.mentionsByEntity.get(entityId)?.length ?? 0) +
          (index.occurrencesByEntity.get(entityId)?.length ?? 0) * 2;
        return score(right.id) - score(left.id);
      });
    for (const entity of ranked.slice(0, limit)) selectedIds.add(entity.id);
    truncated = ranked.length > limit;
  }
  const nodes = [...selectedIds].flatMap((entityId) => {
    const entity = index.entities.get(entityId);
    return entity
      ? [
          {
            entity,
            mentionCount: index.mentionsByEntity.get(entityId)?.length ?? 0,
            assertionCount: index.assertionsByEntity.get(entityId)?.length ?? 0,
            occurrenceCount:
              index.occurrencesByEntity.get(entityId)?.length ?? 0,
          },
        ]
      : [];
  });
  const edges = relations.flatMap((assertion) =>
    assertion.objectId &&
    selectedIds.has(assertion.subjectId) &&
    selectedIds.has(assertion.objectId)
      ? [
          {
            assertionId: assertion.id,
            sourceId: assertion.subjectId,
            targetId: assertion.objectId,
            predicate: assertion.predicate,
            predicateLabel: index.predicateLabel(assertion.predicate),
            ...(assertion.temporal ? { temporal: assertion.temporal } : {}),
            evidence: assertion.evidence,
            reviewStatus: assertion.reviewStatus,
          },
        ]
      : [],
  );
  return { nodes, edges, truncated };
}
