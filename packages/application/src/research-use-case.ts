import type {
  Assertion,
  EntityId,
  EvidenceSpan,
  ResearchFinding,
  ResearchFindingKind,
  ResearchQuery,
  ResearchReport,
} from "@infinite-spacetime/contracts";
import { overlaps } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";
import { boundedLimit, groupBy } from "./query-utils";

export function inspectResearch(
  index: PublicationIndex,
  query: ResearchQuery = {},
): ResearchReport {
  const limit = boundedLimit(query.limit, 200, 1_000);
  const entityIds = query.entityIds ? new Set(query.entityIds) : undefined;
  const workIds = query.workIds ? new Set(query.workIds) : undefined;
  const kinds = query.kinds ? new Set(query.kinds) : undefined;
  const acceptsEntity = (entityId: EntityId) =>
    !entityIds || entityIds.has(entityId);
  const passageIdsFor = (evidence: readonly EvidenceSpan[]) => [
    ...new Set(evidence.map((span) => span.passageId)),
  ];
  const acceptsEvidence = (evidence: readonly EvidenceSpan[]) =>
    !workIds ||
    evidence.some((span) => {
      const passage = index.passages.get(span.passageId);
      const workId = passage ? index.workIdForPassage(passage) : undefined;
      return workId !== undefined && workIds.has(workId);
    });
  const findings: ResearchFinding[] = [];
  const push = (finding: ResearchFinding) => {
    if (!kinds || kinds.has(finding.kind)) findings.push(finding);
  };
  const assertionGroups = groupBy(
    index.publication.assertions.filter(
      (assertion) =>
        acceptsEntity(assertion.subjectId) &&
        acceptsEvidence(assertion.evidence),
    ),
    (assertion) => `${assertion.subjectId}\u0000${assertion.predicate}`,
  );
  for (const assertions of assertionGroups.values()) {
    const valueOf = (assertion: Assertion) =>
      assertion.objectId ?? assertion.literalValue ?? "";
    const conflicting = assertions.filter((assertion, position) =>
      assertions.some(
        (candidate, candidatePosition) =>
          candidatePosition !== position &&
          valueOf(candidate) !== valueOf(assertion) &&
          overlaps(assertion.temporal, candidate.temporal),
      ),
    );
    if (conflicting.length <= 1) continue;
    const first = conflicting[0]!;
    const evidence = conflicting.flatMap((assertion) => assertion.evidence);
    push({
      id: `contradiction:${first.subjectId}:${first.predicate}`,
      kind: "contradictory_assertions",
      severity: "warning",
      title: `${index.entities.get(first.subjectId)?.preferredName ?? "实体"}的“${index.predicateLabel(first.predicate)}”存在不同记载`,
      description: `当前发布包保留了 ${new Set(conflicting.map(valueOf)).size} 个不同值，应回到各自原文核验，不自动合并。`,
      entityIds: [first.subjectId],
      assertionIds: conflicting.map((assertion) => assertion.id),
      passageIds: passageIdsFor(evidence),
    });
  }
  for (const assertion of index.publication.assertions) {
    if (
      assertion.reviewStatus !== "disputed" ||
      !acceptsEntity(assertion.subjectId) ||
      !acceptsEvidence(assertion.evidence)
    )
      continue;
    push({
      id: `disputed:${assertion.id}`,
      kind: "disputed_record",
      severity: "notice",
      title: `争议主张：${index.entities.get(assertion.subjectId)?.preferredName ?? assertion.subjectId}`,
      description: `“${index.predicateLabel(assertion.predicate)}”已标记为争议，系统保留原始证据供并列考察。`,
      entityIds: [assertion.subjectId],
      assertionIds: [assertion.id],
      passageIds: passageIdsFor(assertion.evidence),
    });
  }
  const unresolved = new Set<string>();
  for (const occurrence of index.publication.occurrences) {
    if (
      !acceptsEntity(occurrence.entityId) ||
      !acceptsEvidence(occurrence.evidence) ||
      (index.geometriesByPlace.get(occurrence.placeId) ?? []).length
    )
      continue;
    const key = `${occurrence.entityId}:${occurrence.placeId}`;
    if (unresolved.has(key)) continue;
    unresolved.add(key);
    const place = index.places.get(occurrence.placeId);
    push({
      id: `geometry:${key}`,
      kind: "unresolved_geometry",
      severity: "notice",
      title: `${index.entities.get(occurrence.entityId)?.preferredName ?? "实体"}的时空记录尚未定位`,
      description: `地点“${place ? index.placeLabel(place) : occurrence.placeId}”尚无经过审核的历史几何；原始地名会继续保留。`,
      entityIds: [occurrence.entityId],
      assertionIds: [],
      passageIds: passageIdsFor(occurrence.evidence),
    });
  }
  for (const [entityId, occurrences] of index.occurrencesByEntity) {
    if (!acceptsEntity(entityId)) continue;
    const sequenced = occurrences
      .filter(
        (item) =>
          item.sequence !== undefined && item.temporal?.startYear !== undefined,
      )
      .toSorted((left, right) => left.sequence! - right.sequence!);
    for (let position = 1; position < sequenced.length; position += 1) {
      const previous = sequenced[position - 1]!;
      const current = sequenced[position]!;
      if (current.temporal!.startYear! >= previous.temporal!.startYear!)
        continue;
      push({
        id: `chronology:${entityId}:${previous.id}:${current.id}`,
        kind: "chronology_conflict",
        severity: "critical",
        title: `${index.entities.get(entityId)?.preferredName ?? "实体"}的行迹次序与年代冲突`,
        description:
          "记录的 sequence 顺序与公元纪年倒置，需要核对纪年换算或事件排序。",
        entityIds: [entityId],
        assertionIds: [],
        passageIds: passageIdsFor([...previous.evidence, ...current.evidence]),
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
}
