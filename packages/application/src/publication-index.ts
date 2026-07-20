import {
  predicateDefinition,
  type Assertion,
  type EditionId,
  type EntityId,
  type KnowledgePublication,
  type Passage,
  type PassageId,
  type PlaceIdentity,
  type PredicateId,
  type WorkId,
} from "@infinite-spacetime/contracts";
import { groupBy } from "./query-utils";

/** Shared read-only indexes. Every use case receives this exact instance. */
export class PublicationIndex {
  readonly publication: KnowledgePublication;
  readonly works;
  readonly sources;
  readonly passages;
  readonly entities;
  readonly editions;
  readonly volumes;
  readonly places;
  readonly pages;
  readonly passageAlignmentsByWork;
  readonly geometriesByPlace;
  readonly occurrencesByEntity;
  readonly editionsByWork;
  readonly volumesByEdition;
  readonly passagesByWork;
  readonly passagesByEdition;
  readonly mentionsByPassage;
  readonly mentionsByEntity;
  readonly assertionsByEntity = new Map<EntityId, readonly Assertion[]>();
  readonly assertionsByPassage = new Map<PassageId, readonly Assertion[]>();

  constructor(publication: KnowledgePublication) {
    this.publication = publication;
    this.works = new Map(publication.works.map((item) => [item.id, item]));
    this.sources = new Map(publication.sources.map((item) => [item.id, item]));
    this.passages = new Map(
      publication.passages.map((item) => [item.id, item]),
    );
    this.entities = new Map(
      publication.entities.map((item) => [item.id, item]),
    );
    this.editions = new Map(
      publication.editions.map((item) => [item.id, item]),
    );
    this.volumes = new Map(publication.volumes.map((item) => [item.id, item]));
    this.places = new Map(publication.places.map((item) => [item.id, item]));
    this.pages = new Map(
      publication.facsimilePages.map((item) => [item.id, item]),
    );
    this.passageAlignmentsByWork = groupBy(
      publication.passageAlignments,
      (item) => item.workId,
    );
    this.geometriesByPlace = groupBy(
      publication.geometries,
      (item) => item.placeId,
    );
    this.occurrencesByEntity = groupBy(
      publication.occurrences,
      (item) => item.entityId,
    );
    this.editionsByWork = groupBy(publication.editions, (item) => item.workId);
    this.volumesByEdition = groupBy(
      publication.volumes,
      (item) => item.editionId,
    );
    this.passagesByWork = groupBy(publication.passages, (item) =>
      this.workIdForPassage(item),
    );
    this.passagesByEdition = groupBy(publication.passages, (item) =>
      this.editionIdForPassage(item),
    );
    this.mentionsByPassage = groupBy(
      publication.mentions,
      (item) => item.passageId,
    );
    this.mentionsByEntity = groupBy(
      publication.mentions,
      (item) => item.entityId,
    );
    const byEntity = new Map<EntityId, Assertion[]>();
    const byPassage = new Map<PassageId, Assertion[]>();
    for (const assertion of publication.assertions) {
      this.addGrouped(byEntity, assertion.subjectId, assertion);
      if (assertion.objectId && assertion.objectId !== assertion.subjectId) {
        this.addGrouped(byEntity, assertion.objectId, assertion);
      }
      for (const evidence of assertion.evidence)
        this.addGrouped(byPassage, evidence.passageId, assertion);
    }
    this.assertionsByEntity = byEntity;
    this.assertionsByPassage = byPassage;
  }

  editionIdForPassage(passage: Passage): EditionId | undefined {
    return this.volumes.get(passage.volumeId)?.editionId;
  }

  workIdForPassage(passage: Passage): WorkId | undefined {
    const editionId = this.editionIdForPassage(passage);
    return editionId ? this.editions.get(editionId)?.workId : undefined;
  }

  placeLabel(place: PlaceIdentity): string {
    return (
      this.entities.get(place.entityId)?.preferredName ??
      place.historicalNames[0]?.name ??
      place.id
    );
  }

  predicateLabel(predicate: PredicateId): string {
    return predicateDefinition(predicate).label;
  }

  entityPassages(entityId: EntityId): readonly Passage[] {
    return (this.mentionsByEntity.get(entityId) ?? [])
      .map((mention) => this.passages.get(mention.passageId))
      .filter((passage): passage is Passage => Boolean(passage));
  }

  private addGrouped<K, T>(groups: Map<K, T[]>, key: K, item: T): void {
    const values = groups.get(key) ?? [];
    if (!values.includes(item)) values.push(item);
    groups.set(key, values);
  }
}
