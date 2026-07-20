import type { KnowledgePublication } from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import { createApplicationServices } from "../src";
import { publication } from "./fictional-publication";

function thematicPublication(): KnowledgePublication {
  const value = structuredClone(publication) as KnowledgePublication & {
    entities: Array<
      (typeof publication.entities)[number] | Record<string, unknown>
    >;
    assertions: Array<
      (typeof publication.assertions)[number] | Record<string, unknown>
    >;
    occurrences: Array<Record<string, unknown>>;
  };
  value.entities.push(
    {
      id: "material-tea",
      type: "material",
      preferredName: "云茶",
      aliases: [],
      reviewStatus: "verified",
    },
    {
      id: "artifact-vessel",
      type: "artifact",
      preferredName: "云纹尊",
      aliases: [],
      reviewStatus: "verified",
    },
    {
      id: "event-flood",
      type: "event",
      preferredName: "云川水灾",
      aliases: [],
      reviewStatus: "reviewed",
    },
  );
  value.assertions.push(
    {
      id: "assertion-population",
      subjectId: "place-entity-1",
      predicate: "society.population",
      literalValue: "民三千二百口",
      temporal: { original: "某年", startYear: 150, certainty: "exact" },
      evidence: [{ passageId: "passage-2", start: 0, end: 2 }],
      reviewStatus: "reviewed",
    },
    {
      id: "assertion-product",
      subjectId: "place-entity-1",
      predicate: "society.local_product",
      objectId: "material-tea",
      evidence: [{ passageId: "passage-2", start: 0, end: 2 }],
      reviewStatus: "verified",
    },
    {
      id: "assertion-material",
      subjectId: "artifact-vessel",
      predicate: "heritage.material",
      objectId: "material-tea",
      evidence: [{ passageId: "passage-1", start: 0, end: 2 }],
      reviewStatus: "verified",
    },
    {
      id: "assertion-event-kind",
      subjectId: "event-flood",
      predicate: "event.kind",
      literalValue: "水灾",
      evidence: [{ passageId: "passage-2", start: 0, end: 2 }],
      reviewStatus: "reviewed",
    },
  );
  value.occurrences.push({
    id: "occurrence-artifact",
    entityId: "artifact-vessel",
    placeId: "place-1",
    kind: "collection",
    temporal: { original: "今", startYear: 200, certainty: "approximate" },
    evidence: [{ passageId: "passage-1", start: 0, end: 2 }],
    reviewStatus: "reviewed",
  });
  return value;
}

describe("gazetteer thematic projections", () => {
  const source = thematicPublication();
  const services = createApplicationServices({
    dataContext: source.manifest,
    readPublication: () => source,
  });

  it("builds local-society topics from governed facts", async () => {
    const result = await services.society.explore({
      topics: ["livelihood"],
      temporal: { original: "150", startYear: 150, certainty: "exact" },
    });
    expect(result.records.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: expect.objectContaining({ id: "place-entity-1" }),
          topics: ["livelihood"],
          evidencePassageIds: ["passage-2"],
        }),
      ]),
    );
    expect(
      result.topics.find((item) => item.topic === "livelihood"),
    ).toMatchObject({ entityCount: 2, assertionCount: 2 });
  });

  it("builds heritage dossiers from the same assertions and occurrences", async () => {
    const result = await services.heritage.explore({
      types: ["artifact"],
      text: "云纹",
    });
    expect(result.items[0]).toMatchObject({
      entity: { id: "artifact-vessel" },
      assertions: [{ predicate: "heritage.material" }],
      occurrences: [{ kind: "collection" }],
      relatedEntities: [{ id: "material-tea" }],
    });
  });
});
