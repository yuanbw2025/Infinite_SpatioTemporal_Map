import type {
  Assertion,
  Entity,
  EntityId,
  HeritageQuery,
  HeritageRecord,
  Page,
  PassageId,
  SocietyQuery,
  SocietyResult,
  SocietyTopic,
  SpatiotemporalOccurrence,
  ThematicRecord,
} from "@infinite-spacetime/contracts";
import { overlaps } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";
import { paginate } from "./query-utils";

const societyTopics: readonly SocietyTopic[] = [
  "kinship",
  "education",
  "office",
  "association",
  "mobility",
  "events",
  "livelihood",
];
const heritageTypes = new Set([
  "artifact",
  "site",
  "institution",
  "material",
  "technique",
  "motif",
  "inscription",
]);

function assertionTopic(assertion: Assertion): SocietyTopic | undefined {
  if (assertion.predicate.startsWith("family.")) return "kinship";
  if (assertion.predicate.startsWith("education.")) return "education";
  if (assertion.predicate.startsWith("office.")) return "office";
  if (assertion.predicate.startsWith("social.")) return "association";
  if (assertion.predicate.startsWith("place.")) return "mobility";
  if (assertion.predicate.startsWith("event.")) return "events";
  if (assertion.predicate.startsWith("society.")) return "livelihood";
  return undefined;
}

function occurrenceTopic(
  occurrence: SpatiotemporalOccurrence,
): SocietyTopic | undefined {
  if (occurrence.kind === "office") return "office";
  if (["native_place", "residence", "journey"].includes(occurrence.kind))
    return "mobility";
  if (occurrence.kind === "event") return "events";
  return undefined;
}

function relatedEntities(
  index: PublicationIndex,
  entityId: EntityId,
  assertions: readonly Assertion[],
): readonly Entity[] {
  const ids = new Set<EntityId>();
  for (const assertion of assertions) {
    if (assertion.subjectId !== entityId) ids.add(assertion.subjectId);
    if (assertion.objectId && assertion.objectId !== entityId)
      ids.add(assertion.objectId);
  }
  return [...ids].flatMap((id) => {
    const entity = index.entities.get(id);
    return entity ? [entity] : [];
  });
}

function evidencePassageIds(
  assertions: readonly Assertion[],
  occurrences: readonly SpatiotemporalOccurrence[],
): readonly PassageId[] {
  return [
    ...new Set([
      ...assertions.flatMap((item) =>
        item.evidence.map((span) => span.passageId),
      ),
      ...occurrences.flatMap((item) =>
        item.evidence.map((span) => span.passageId),
      ),
    ]),
  ];
}

function acceptsText(entity: Entity, text: string | undefined): boolean {
  const term = text?.trim().toLocaleLowerCase();
  return (
    !term ||
    `${entity.preferredName} ${entity.aliases.join(" ")} ${entity.summary ?? ""}`
      .toLocaleLowerCase()
      .includes(term)
  );
}

function supportingFacts(
  index: PublicationIndex,
  entity: Entity,
  temporal: SocietyQuery["temporal"],
  reviewStatuses: SocietyQuery["reviewStatuses"],
) {
  const statuses = reviewStatuses ? new Set(reviewStatuses) : undefined;
  const assertions = (index.assertionsByEntity.get(entity.id) ?? []).filter(
    (item) =>
      (!statuses || statuses.has(item.reviewStatus)) &&
      overlaps(item.temporal, temporal),
  );
  const occurrences = (index.occurrencesByEntity.get(entity.id) ?? []).filter(
    (item) =>
      (!statuses || statuses.has(item.reviewStatus)) &&
      overlaps(item.temporal, temporal),
  );
  return { assertions, occurrences };
}

export function exploreSociety(
  index: PublicationIndex,
  query: SocietyQuery = {},
): SocietyResult {
  const requested = query.topics ? new Set(query.topics) : undefined;
  const records: ThematicRecord[] = [];
  for (const entity of index.publication.entities) {
    if (!acceptsText(entity, query.text)) continue;
    if (
      query.reviewStatuses &&
      !query.reviewStatuses.includes(entity.reviewStatus)
    )
      continue;
    const { assertions, occurrences } = supportingFacts(
      index,
      entity,
      query.temporal,
      query.reviewStatuses,
    );
    const topics = new Set<SocietyTopic>();
    for (const assertion of assertions) {
      const topic = assertionTopic(assertion);
      if (topic) topics.add(topic);
    }
    for (const occurrence of occurrences) {
      const topic = occurrenceTopic(occurrence);
      if (topic) topics.add(topic);
    }
    if (entity.type === "event") topics.add("events");
    const selectedTopics = [...topics].filter(
      (topic) => !requested || requested.has(topic),
    );
    if (!selectedTopics.length) continue;
    const relevantAssertions = assertions.filter((item) =>
      selectedTopics.includes(assertionTopic(item)!),
    );
    const relevantOccurrences = occurrences.filter((item) =>
      selectedTopics.includes(occurrenceTopic(item)!),
    );
    records.push({
      entity,
      topics: selectedTopics,
      assertions: relevantAssertions,
      occurrences: relevantOccurrences,
      relatedEntities: relatedEntities(index, entity.id, relevantAssertions),
      evidencePassageIds: evidencePassageIds(
        relevantAssertions,
        relevantOccurrences,
      ),
    });
  }
  const topics = societyTopics.map((topic) => {
    const matching = records.filter((record) => record.topics.includes(topic));
    const assertions = new Map(
      matching
        .flatMap((record) =>
          record.assertions.filter((item) => assertionTopic(item) === topic),
        )
        .map((item) => [item.id, item]),
    );
    const occurrences = new Map(
      matching
        .flatMap((record) =>
          record.occurrences.filter((item) => occurrenceTopic(item) === topic),
        )
        .map((item) => [item.id, item]),
    );
    return {
      topic,
      entityCount: matching.length,
      assertionCount: assertions.size,
      occurrenceCount: occurrences.size,
      evidencePassageCount: new Set(
        matching.flatMap((record) => record.evidencePassageIds),
      ).size,
    };
  });
  return { topics, records: paginate(records, query) };
}

export function exploreHeritage(
  index: PublicationIndex,
  query: HeritageQuery = {},
): Page<HeritageRecord> {
  const types = query.types ? new Set(query.types) : heritageTypes;
  const records = index.publication.entities.flatMap((entity) => {
    if (!types.has(entity.type) || !acceptsText(entity, query.text)) return [];
    if (
      query.reviewStatuses &&
      !query.reviewStatuses.includes(entity.reviewStatus)
    )
      return [];
    const { assertions, occurrences } = supportingFacts(
      index,
      entity,
      query.temporal,
      query.reviewStatuses,
    );
    const hasHeritageContext =
      entity.type === "artifact" ||
      entity.type === "site" ||
      assertions.some((item) => item.predicate.startsWith("heritage.")) ||
      occurrences.some((item) =>
        ["creation", "discovery", "collection"].includes(item.kind),
      );
    if (!hasHeritageContext) return [];
    return [
      {
        entity,
        assertions,
        occurrences,
        relatedEntities: relatedEntities(index, entity.id, assertions),
        evidencePassageIds: evidencePassageIds(assertions, occurrences),
      },
    ];
  });
  return paginate(records, query);
}
