import type {
  Assertion,
  EntityId,
  EvidenceSpan,
  ResearchFinding,
  ResearchQuery,
} from "@infinite-spacetime/contracts";
import { overlaps } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";
import { groupBy } from "./query-utils";

export interface ResearchRule {
  readonly id: string;
  inspect(index: PublicationIndex, query: ResearchQuery): ResearchFinding[];
}

interface ResearchScope {
  acceptsEntity(entityId: EntityId): boolean;
  acceptsEvidence(evidence: readonly EvidenceSpan[]): boolean;
  passageIdsFor(
    evidence: readonly EvidenceSpan[],
  ): readonly EvidenceSpan["passageId"][];
}

function createScope(
  index: PublicationIndex,
  query: ResearchQuery,
): ResearchScope {
  const entityIds = query.entityIds ? new Set(query.entityIds) : undefined;
  const workIds = query.workIds ? new Set(query.workIds) : undefined;
  return {
    acceptsEntity: (entityId) => !entityIds || entityIds.has(entityId),
    acceptsEvidence: (evidence) =>
      !workIds ||
      evidence.some((span) => {
        const passage = index.passages.get(span.passageId);
        const workId = passage ? index.workIdForPassage(passage) : undefined;
        return workId !== undefined && workIds.has(workId);
      }),
    passageIdsFor: (evidence) => [
      ...new Set(evidence.map((span) => span.passageId)),
    ],
  };
}

const contradictoryAssertions: ResearchRule = {
  id: "core.contradictory-assertions",
  inspect(index, query) {
    const scope = createScope(index, query);
    const findings: ResearchFinding[] = [];
    const groups = groupBy(
      index.publication.assertions.filter(
        (assertion) =>
          scope.acceptsEntity(assertion.subjectId) &&
          scope.acceptsEvidence(assertion.evidence),
      ),
      (assertion) => `${assertion.subjectId}\u0000${assertion.predicate}`,
    );
    for (const assertions of groups.values()) {
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
      findings.push({
        id: `contradiction:${first.subjectId}:${first.predicate}`,
        ruleId: contradictoryAssertions.id,
        kind: "contradictory_assertions",
        severity: "warning",
        title: `${index.entities.get(first.subjectId)?.preferredName ?? "实体"}的“${index.predicateLabel(first.predicate)}”存在不同记载`,
        description: `当前发布包保留了 ${new Set(conflicting.map(valueOf)).size} 个不同值，应回到各自原文核验，不自动合并。`,
        entityIds: [first.subjectId],
        assertionIds: conflicting.map((assertion) => assertion.id),
        passageIds: scope.passageIdsFor(evidence),
      });
    }
    return findings;
  },
};

const disputedRecords: ResearchRule = {
  id: "core.disputed-records",
  inspect(index, query) {
    const scope = createScope(index, query);
    return index.publication.assertions.flatMap((assertion) => {
      if (
        assertion.reviewStatus !== "disputed" ||
        !scope.acceptsEntity(assertion.subjectId) ||
        !scope.acceptsEvidence(assertion.evidence)
      )
        return [];
      return [
        {
          id: `disputed:${assertion.id}`,
          ruleId: disputedRecords.id,
          kind: "disputed_record" as const,
          severity: "notice" as const,
          title: `争议主张：${index.entities.get(assertion.subjectId)?.preferredName ?? assertion.subjectId}`,
          description: `“${index.predicateLabel(assertion.predicate)}”已标记为争议，系统保留原始证据供并列考察。`,
          entityIds: [assertion.subjectId],
          assertionIds: [assertion.id],
          passageIds: scope.passageIdsFor(assertion.evidence),
        },
      ];
    });
  },
};

const unresolvedGeometry: ResearchRule = {
  id: "core.unresolved-geometry",
  inspect(index, query) {
    const scope = createScope(index, query);
    const seen = new Set<string>();
    return index.publication.occurrences.flatMap((occurrence) => {
      if (
        !scope.acceptsEntity(occurrence.entityId) ||
        !scope.acceptsEvidence(occurrence.evidence) ||
        (index.geometriesByPlace.get(occurrence.placeId) ?? []).length
      )
        return [];
      const key = `${occurrence.entityId}:${occurrence.placeId}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const place = index.places.get(occurrence.placeId);
      return [
        {
          id: `geometry:${key}`,
          ruleId: unresolvedGeometry.id,
          kind: "unresolved_geometry" as const,
          severity: "notice" as const,
          title: `${index.entities.get(occurrence.entityId)?.preferredName ?? "实体"}的时空记录尚未定位`,
          description: `地点“${place ? index.placeLabel(place) : occurrence.placeId}”尚无经过审核的历史几何；原始地名会继续保留。`,
          entityIds: [occurrence.entityId],
          assertionIds: [],
          passageIds: scope.passageIdsFor(occurrence.evidence),
        },
      ];
    });
  },
};

const chronologyConflicts: ResearchRule = {
  id: "core.chronology-conflicts",
  inspect(index, query) {
    const scope = createScope(index, query);
    const findings: ResearchFinding[] = [];
    for (const [entityId, occurrences] of index.occurrencesByEntity) {
      if (!scope.acceptsEntity(entityId)) continue;
      const sequenced = occurrences
        .filter(
          (item) =>
            item.sequence !== undefined &&
            item.temporal?.startYear !== undefined &&
            scope.acceptsEvidence(item.evidence),
        )
        .toSorted((left, right) => left.sequence! - right.sequence!);
      for (let position = 1; position < sequenced.length; position += 1) {
        const previous = sequenced[position - 1]!;
        const current = sequenced[position]!;
        if (current.temporal!.startYear! >= previous.temporal!.startYear!)
          continue;
        findings.push({
          id: `chronology:${entityId}:${previous.id}:${current.id}`,
          ruleId: chronologyConflicts.id,
          kind: "chronology_conflict",
          severity: "critical",
          title: `${index.entities.get(entityId)?.preferredName ?? "实体"}的行迹次序与年代冲突`,
          description:
            "记录的 sequence 顺序与公元纪年倒置，需要核对纪年换算或事件排序。",
          entityIds: [entityId],
          assertionIds: [],
          passageIds: scope.passageIdsFor([
            ...previous.evidence,
            ...current.evidence,
          ]),
        });
      }
    }
    return findings;
  },
};

export const BUILT_IN_RESEARCH_RULES: readonly ResearchRule[] = [
  contradictoryAssertions,
  disputedRecords,
  unresolvedGeometry,
  chronologyConflicts,
];
