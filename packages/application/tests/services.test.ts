import type {
  EntityId,
  KnowledgePublication,
  PassageId,
  SourceId,
  WorkId,
} from "@infinite-spacetime/contracts";
import { NotFoundError } from "@infinite-spacetime/domain";
import { describe, expect, it } from "vitest";
import { createApplicationServices } from "../src";
import { port, publication } from "./fictional-publication";
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
    await expect(
      services.reader.resolveFacsimile(publication.facsimilePages[0]!),
    ).resolves.toMatchObject({
      imageUrl: "https://example.invalid/page.jpg",
      source: "direct",
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
    expect(
      await services.provenance.openSource("source-1" as SourceId),
    ).toMatchObject({
      center: { id: "source-1" },
      sources: expect.arrayContaining([
        expect.objectContaining({ id: "source-1" }),
        expect.objectContaining({ id: "source-2" }),
      ]),
      relations: [{ relationType: "derived_from" }],
      works: [{ id: "work-1" }],
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
    ).toEqual([
      expect.objectContaining({
        predicate: "social.friend_of",
        predicateLabel: "友人",
      }),
    ]);
    expect(
      (await services.timeline.build()).tracks.flatMap((track) => track.items),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ predicateLabel: "官职原称" }),
      ]),
    );
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
    await expect(services.search.run({ text: "   " })).resolves.toMatchObject({
      items: [],
      requestedMode: "lexical",
      executedMode: "lexical",
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

  it("delegates optional infrastructure without changing use-case contracts", async () => {
    const externalSearch = {
      search: async () => ({ items: [] }),
    };
    const externalSpatial = {
      explore: async () => ({ observations: [] }),
    };
    const facsimileImages = {
      resolveCanvas: async (canvasUrl: string) => ({
        imageUrl: "https://example.invalid/resolved.jpg",
        canvasUrl,
        source: "iiif" as const,
      }),
    };
    const services = createApplicationServices(port, {
      searchIndex: externalSearch,
      spatialQuery: externalSpatial,
      facsimileImages,
      researchRules: [
        {
          id: "test.external-rule",
          inspect: async () => [
            {
              id: "external:test",
              ruleId: "test.external-rule",
              kind: "disputed_record",
              severity: "notice",
              title: "外部规则测试",
              description: "只读规则返回的可验证线索",
              entityIds: ["person-1" as EntityId],
              assertionIds: [],
              passageIds: ["passage-1" as PassageId],
            },
          ],
        },
      ],
    });
    const { imageUrl: _imageUrl, ...iiifOnlyPage } =
      publication.facsimilePages[0]!;
    await expect(
      services.search.run({ text: "anything" }),
    ).resolves.toMatchObject({
      items: [],
      executedMode: "lexical",
    });
    await expect(services.atlas.explore({})).resolves.toEqual({
      observations: [],
    });
    await expect(
      services.reader.resolveFacsimile({
        ...iiifOnlyPage,
        canvasUrl: "https://example.invalid/canvas/1",
      }),
    ).resolves.toMatchObject({ source: "iiif" });
    await expect(
      services.research.inspect({ kinds: ["disputed_record"] }),
    ).resolves.toMatchObject({
      findings: expect.arrayContaining([
        expect.objectContaining({ ruleId: "test.external-rule" }),
      ]),
    });
  });

  it("executes semantic, hybrid, and explicit lexical fallback modes", async () => {
    const semanticSearch = {
      search: async () => [
        { kind: "entity" as const, id: "person-1" as EntityId, score: 0.9 },
        {
          kind: "passage" as const,
          id: "passage-2" as PassageId,
          score: 0.8,
        },
      ],
    };
    const services = createApplicationServices(port, { semanticSearch });
    await expect(
      services.search.run({ text: "行旅者", mode: "semantic" }),
    ).resolves.toMatchObject({
      requestedMode: "semantic",
      executedMode: "semantic",
      items: [
        expect.objectContaining({ kind: "entity", score: 0.9 }),
        expect.objectContaining({ kind: "passage", score: 0.8 }),
      ],
    });
    const hybrid = await services.search.run({
      text: "云川",
      mode: "hybrid",
    });
    expect(hybrid.executedMode).toBe("hybrid");
    expect(new Set(hybrid.items.map((item) => item.kind))).toEqual(
      new Set(["work", "entity", "passage"]),
    );

    const fallback = await createApplicationServices(port).search.run({
      text: "云川",
      mode: "semantic",
    });
    expect(fallback).toMatchObject({
      requestedMode: "semantic",
      executedMode: "lexical",
      notice: expect.stringContaining("回退"),
    });
  });

  it("rejects untrusted research output with broken references", async () => {
    const services = createApplicationServices(port, {
      researchRules: [
        {
          id: "test.invalid-rule",
          inspect: async () => [
            {
              id: "invalid:test",
              ruleId: "test.invalid-rule",
              kind: "disputed_record",
              severity: "notice",
              title: "坏引用",
              description: "测试边界校验",
              entityIds: ["missing" as EntityId],
              assertionIds: [],
              passageIds: [],
            },
          ],
        },
      ],
    });
    await expect(services.research.inspect()).rejects.toThrow("missing entity");
  });
});
