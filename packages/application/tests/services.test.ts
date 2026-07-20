import type {
  EntityId,
  KnowledgePublication,
  PassageId,
  PublicationId,
  WorkId,
} from "@infinite-spacetime/contracts";
import { NotFoundError } from "@infinite-spacetime/domain";
import type { PublicationReadPort } from "@infinite-spacetime/ports";
import { describe, expect, it } from "vitest";
import { createApplicationServices } from "../src";

const publication = {
  manifest: {
    contractVersion: "0.4.0",
    publicationId: "application-test" as PublicationId,
    datasetVersion: "1.0.0",
    title: "虚构测试发布包",
    generatedAt: "1970-01-01T00:00:00Z",
    contentChecksum: `sha256:${"0".repeat(64)}`,
    sourceDescription: "fictional test data",
  },
  sources: [
    {
      id: "source-1",
      kind: "facsimile",
      title: "虚构影印本",
      rightsStatement: "test only",
    },
  ],
  works: [
    {
      id: "work-1",
      title: "云川县志",
      alternativeTitles: ["云川志"],
      category: "gazetteer",
      abstract: "虚构测试方志",
      coverage: {
        regionLabels: ["云川"],
        temporal: { startYear: 100, endYear: 200 },
      },
      sourceRefs: [{ sourceId: "source-1" }],
    },
  ],
  editions: [
    {
      id: "edition-1",
      workId: "work-1",
      label: "虚构刻本",
      sourceRefs: [{ sourceId: "source-1" }],
    },
  ],
  volumes: [
    { id: "volume-1", editionId: "edition-1", label: "卷一", sequence: 1 },
  ],
  facsimilePages: [
    {
      id: "page-1",
      volumeId: "volume-1",
      sequence: 1,
      image: { uri: "https://example.invalid/page.jpg" },
    },
  ],
  passages: [
    {
      id: "passage-1",
      volumeId: "volume-1",
      sequence: 1,
      text: {
        original: "沈舟至云川。",
        simplified: "沈舟至云川。",
        modernTranslation: "沈舟抵达云川。",
      },
      facsimileAnchors: [{ pageId: "page-1" }],
      revision: 1,
    },
    {
      id: "passage-2",
      volumeId: "volume-1",
      sequence: 2,
      text: { original: "云川又名青崖。" },
      facsimileAnchors: [],
      revision: 1,
    },
  ],
  entities: [
    {
      id: "person-1",
      type: "person",
      preferredName: "沈舟",
      aliases: ["子虚"],
      reviewStatus: "verified",
    },
    {
      id: "place-entity-1",
      type: "place",
      preferredName: "云川",
      aliases: ["青崖"],
      reviewStatus: "reviewed",
    },
    {
      id: "person-2",
      type: "person",
      preferredName: "陆遥",
      aliases: [],
      reviewStatus: "raw",
    },
  ],
  mentions: [
    {
      id: "mention-1",
      passageId: "passage-1",
      entityId: "person-1",
      start: 0,
      end: 2,
      surface: "沈舟",
      reviewStatus: "verified",
    },
    {
      id: "mention-2",
      passageId: "passage-1",
      entityId: "place-entity-1",
      start: 3,
      end: 5,
      surface: "云川",
      reviewStatus: "reviewed",
    },
  ],
  assertions: [
    {
      id: "assertion-1",
      subjectId: "person-1",
      predicate: "friend_of",
      objectId: "person-2",
      temporal: { startYear: 120 },
      evidence: [{ passageId: "passage-1", start: 0, end: 5 }],
      reviewStatus: "reviewed",
    },
    {
      id: "assertion-2",
      subjectId: "person-1",
      predicate: "office",
      literalValue: "县令",
      temporal: { startYear: 130 },
      evidence: [{ passageId: "passage-1", start: 0, end: 2 }],
      reviewStatus: "disputed",
    },
    {
      id: "assertion-3",
      subjectId: "person-1",
      predicate: "office",
      literalValue: "主簿",
      temporal: { startYear: 130 },
      evidence: [{ passageId: "passage-2", start: 0, end: 2 }],
      reviewStatus: "reviewed",
    },
  ],
  places: [
    {
      id: "place-1",
      entityId: "place-entity-1",
      historicalNames: [
        {
          name: "青崖",
          validDuring: { startYear: 100, endYear: 140 },
          evidence: [],
          sourceRefs: [],
        },
      ],
      parentPlaceIds: [],
    },
    {
      id: "place-2",
      entityId: "place-entity-1",
      historicalNames: [{ name: "未定位地", evidence: [], sourceRefs: [] }],
      parentPlaceIds: [],
    },
  ],
  geometries: [
    {
      id: "geometry-1",
      placeId: "place-1",
      geometry: { type: "Point", coordinates: [110, 30] },
      validDuring: { startYear: 100, endYear: 200 },
      sourceRefs: [{ sourceId: "source-1" }],
      reviewStatus: "reviewed",
    },
  ],
  occurrences: [
    {
      id: "occurrence-1",
      entityId: "person-1",
      placeId: "place-1",
      kind: "travel",
      label: "抵达云川",
      temporal: { startYear: 150 },
      sequence: 1,
      evidence: [{ passageId: "passage-1", start: 0, end: 5 }],
      reviewStatus: "reviewed",
    },
    {
      id: "occurrence-2",
      entityId: "person-1",
      placeId: "place-1",
      kind: "travel",
      temporal: { startYear: 140 },
      sequence: 2,
      evidence: [{ passageId: "passage-2", start: 0, end: 2 }],
      reviewStatus: "machine_suggested",
    },
    {
      id: "occurrence-3",
      entityId: "person-2",
      placeId: "place-2",
      kind: "residence",
      evidence: [{ passageId: "passage-2", start: 0, end: 2 }],
      reviewStatus: "raw",
    },
  ],
} as unknown as KnowledgePublication;

const port: PublicationReadPort = {
  dataContext: publication.manifest,
  readPublication: () => publication,
};

describe("application services", () => {
  it("projects every capability from one publication", async () => {
    const services = createApplicationServices(port);
    expect(services.dataContext.publicationId).toBe("application-test");

    expect(
      (await services.library.listWorks({ text: "云川" })).items,
    ).toHaveLength(1);
    expect(await services.library.openWork("work-1" as WorkId)).toMatchObject({
      editions: [{ id: "edition-1" }],
      sources: [{ id: "source-1" }],
    });
    expect(
      await services.library.listVolumes("edition-1" as never),
    ).toHaveLength(1);

    const passages = await services.reader.listPassages({
      workId: "work-1" as WorkId,
      limit: 1,
    });
    expect(passages.nextCursor).toBe("1");
    expect(
      await services.reader.readPassage("passage-1" as PassageId),
    ).toMatchObject({
      nextPassageId: "passage-2",
      facsimiles: [{ page: { id: "page-1" } }],
      mentionedEntities: [{ id: "person-1" }, { id: "place-entity-1" }],
    });

    expect(
      (await services.knowledge.listEntities({ text: "沈舟" })).items[0],
    ).toMatchObject({
      mentionCount: 1,
      assertionCount: 3,
      occurrenceCount: 2,
    });
    expect(
      await services.knowledge.openEntity("person-1" as EntityId),
    ).toMatchObject({
      relatedEntityIds: expect.arrayContaining(["person-2", "place-entity-1"]),
      occurrencePlaces: [{ id: "place-1" }],
    });

    const atlas = await services.atlas.explore({
      temporal: { original: "120", certainty: "exact", startYear: 120 },
    });
    expect(atlas.observations).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "青崖" })]),
    );
    expect((await services.search.run({ text: "云川" })).items).toHaveLength(4);
    expect(
      (await services.graph.explore({ centerEntityId: "person-1" as EntityId }))
        .edges,
    ).toHaveLength(1);
    expect((await services.timeline.build()).tracks).toHaveLength(1);
    expect((await services.metadata.overview()).counts).toMatchObject({
      works: 1,
      passages: 2,
      occurrences: 3,
    });

    const report = await services.research.inspect();
    expect(report.counts).toEqual({
      contradictory_assertions: 1,
      disputed_record: 1,
      unresolved_geometry: 1,
      chronology_conflict: 1,
    });
  });

  it("applies filters, pagination bounds, and empty branches", async () => {
    const services = createApplicationServices(port);
    await expect(
      services.library.listWorks({ categories: ["history"], region: "别处" }),
    ).resolves.toEqual({ items: [] });
    await expect(
      services.reader.listPassages({
        workId: "work-1" as WorkId,
        editionId: "missing" as never,
        volumeId: "missing" as never,
      }),
    ).resolves.toEqual({ items: [] });
    await expect(services.search.run({ text: "   " })).resolves.toEqual({
      items: [],
    });
    expect(
      (
        await services.search.run({
          text: "子虚",
          workIds: ["work-1" as WorkId],
          entityTypes: ["person"],
          reviewStatuses: ["verified"],
          region: "云川",
          temporal: {
            original: "130",
            certainty: "exact",
            startYear: 130,
          },
        })
      ).items,
    ).toHaveLength(1);
    expect(
      (await services.atlas.explore({ west: 200 })).observations,
    ).toHaveLength(0);
    expect(
      (await services.graph.explore({ entityTypes: ["event"], limit: 1 }))
        .nodes,
    ).toHaveLength(0);
    expect(
      (await services.timeline.build({ startYear: 999 })).tracks,
    ).toHaveLength(0);
    expect(
      (
        await services.research.inspect({
          kinds: ["disputed_record"],
          limit: 1,
        })
      ).findings,
    ).toHaveLength(1);
  });

  it("raises named errors for missing aggregate roots and broken context", async () => {
    const services = createApplicationServices(port);
    await expect(
      services.library.openWork("missing" as WorkId),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      services.reader.readPassage("missing" as PassageId),
    ).rejects.toThrow("Passage not found");
    await expect(
      services.knowledge.openEntity("missing" as EntityId),
    ).rejects.toThrow("Entity not found");

    const broken = {
      ...structuredClone(publication),
      volumes: [],
    } as KnowledgePublication;
    const brokenServices = createApplicationServices({
      dataContext: broken.manifest,
      readPublication: () => broken,
    });
    await expect(
      brokenServices.reader.readPassage("passage-1" as PassageId),
    ).rejects.toThrow("Passage context not found");
  });
});
