import type {
  EntityId,
  EvidenceSpan,
  TimelineItem,
  TimelineQuery,
  TimelineResult,
} from "@infinite-spacetime/contracts";
import { overlapsYears } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";
import { boundedLimit, groupBy } from "./query-utils";

export function buildTimeline(
  index: PublicationIndex,
  query: TimelineQuery = {},
): TimelineResult {
  const limit = boundedLimit(query.limit, 500, 2_000);
  const entityIds = query.entityIds ? new Set(query.entityIds) : undefined;
  const entityTypes = query.entityTypes
    ? new Set(query.entityTypes)
    : undefined;
  const workIds = query.workIds ? new Set(query.workIds) : undefined;
  const acceptsEntity = (entityId: EntityId) => {
    const entity = index.entities.get(entityId);
    return Boolean(
      entity &&
      (!entityIds || entityIds.has(entityId)) &&
      (!entityTypes || entityTypes.has(entity.type)),
    );
  };
  const acceptsEvidence = (evidence: readonly EvidenceSpan[]) =>
    !workIds ||
    evidence.some((span) => {
      const passage = index.passages.get(span.passageId);
      const workId = passage ? index.workIdForPassage(passage) : undefined;
      return workId !== undefined && workIds.has(workId);
    });
  const allItems: TimelineItem[] = [];
  let undatedCount = 0;
  for (const occurrence of index.publication.occurrences) {
    if (
      !acceptsEntity(occurrence.entityId) ||
      !acceptsEvidence(occurrence.evidence)
    )
      continue;
    if (!occurrence.temporal) {
      undatedCount += 1;
      continue;
    }
    if (!overlapsYears(occurrence.temporal, query.startYear, query.endYear))
      continue;
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
  for (const assertion of index.publication.assertions) {
    if (
      !acceptsEntity(assertion.subjectId) ||
      !acceptsEvidence(assertion.evidence)
    )
      continue;
    if (!assertion.temporal) {
      undatedCount += 1;
      continue;
    }
    if (!overlapsYears(assertion.temporal, query.startYear, query.endYear))
      continue;
    const objectLabel = assertion.objectId
      ? index.entities.get(assertion.objectId)?.preferredName
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
  const tracks = [
    ...groupBy(limitedItems, (item) => item.entityId).entries(),
  ].flatMap(([entityId, items]) => {
    const entity = index.entities.get(entityId);
    return entity ? [{ entity, items }] : [];
  });
  const years = limitedItems.flatMap((item) => [
    ...(item.temporal.startYear !== undefined ? [item.temporal.startYear] : []),
    ...(item.temporal.endYear !== undefined ? [item.temporal.endYear] : []),
  ]);
  const range = years.length
    ? { startYear: Math.min(...years), endYear: Math.max(...years) }
    : undefined;
  return {
    tracks,
    ...(range ? { range } : {}),
    undatedCount,
    truncated: sortedItems.length > limit,
  };
}
