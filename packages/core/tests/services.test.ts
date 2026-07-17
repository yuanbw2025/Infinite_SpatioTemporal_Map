import type {
  DataContext,
  Edition,
  EditionId,
  EntityId,
  EntityProfile,
  PassageContext,
  PassageId,
  PublicationId,
  SourceId,
  SourceRecord,
  Work,
  WorkId,
} from "@infinite-spacetime/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  createApplicationServices,
  ContractMismatchError,
  NotFoundError,
  type RepositoryBundle,
} from "../src";

const workId = "work-a" as WorkId;
const editionId = "edition-a" as EditionId;
const passageId = "passage-a" as PassageId;
const entityId = "entity-a" as EntityId;
const sourceId = "source-a" as SourceId;
const dataContext: DataContext = {
  contractVersion: "0.4.0",
  publicationId: "publication-a" as PublicationId,
  datasetVersion: "1.0.0",
  contentChecksum: `sha256:${"0".repeat(64)}`,
};
const work: Work = {
  id: workId,
  title: "某县志",
  alternativeTitles: [],
  category: "gazetteer",
  sourceRefs: [{ sourceId }],
};
const edition: Edition = {
  id: editionId,
  workId,
  label: "测试本",
  sourceRefs: [{ sourceId }],
};
const source: SourceRecord = {
  id: sourceId,
  kind: "facsimile",
  title: "测试来源",
  rightsStatement: "Public domain",
};

function createRepositories(): RepositoryBundle {
  return {
    dataContext,
    catalog: {
      listWorks: vi.fn(async () => ({ items: [work] })),
      getWork: vi.fn(async () => work),
      listEditions: vi.fn(async () => [edition]),
      listVolumes: vi.fn(async () => []),
      listSources: vi.fn(async () => [source]),
    },
    reader: {
      getPassage: vi.fn(async () => null),
      getPassageContext: vi.fn(
        async () => ({ passage: { id: passageId } }) as PassageContext,
      ),
      listPassages: vi.fn(async () => ({ items: [] })),
    },
    knowledge: {
      getEntity: vi.fn(async () => null),
      getEntityProfile: vi.fn(
        async () => ({ entity: { id: entityId } }) as EntityProfile,
      ),
      listEntities: vi.fn(async () => ({ items: [] })),
      findAssertionsByEntity: vi.fn(async () => []),
    },
    atlas: {
      exploreAtlas: vi.fn(async () => ({ observations: [] })),
    },
    search: {
      search: vi.fn(async () => ({ items: [] })),
    },
    metadata: {
      getDatasetOverview: vi.fn(
        async () =>
          ({
            manifest: {},
            counts: {},
            quality: {},
          }) as never,
      ),
    },
    graph: {
      exploreGraph: vi.fn(async () => ({
        nodes: [],
        edges: [],
        truncated: false,
      })),
    },
    timeline: {
      buildTimeline: vi.fn(async () => ({
        tracks: [],
        undatedCount: 0,
        truncated: false,
      })),
    },
    research: {
      inspectResearch: vi.fn(async () => ({
        findings: [],
        counts: {
          contradictory_assertions: 0,
          disputed_record: 0,
          unresolved_geometry: 0,
          chronology_conflict: 0,
        },
        truncated: false,
      })),
    },
  };
}

describe("application services", () => {
  it("keeps every capability on one immutable data identity", async () => {
    const services = createApplicationServices(createRepositories());
    expect(services.dataContext).toBe(dataContext);
    await expect(services.library.listWorks()).resolves.toEqual({
      items: [work],
    });
    await expect(services.library.openWork(workId)).resolves.toEqual({
      work,
      editions: [edition],
      sources: [source],
    });
    await services.library.listVolumes(editionId);
    await services.reader.listPassages({ workId });
    await services.reader.readPassage(passageId);
    await services.knowledge.listEntities();
    await services.knowledge.openEntity(entityId);
    await services.atlas.explore({});
    await services.search.run({ text: "张三" });
    await services.metadata.overview();
    await services.graph.explore();
    await services.timeline.build();
    await services.research.inspect();
  });

  it("raises one domain error for missing aggregate roots", async () => {
    const repositories = createRepositories();
    repositories.catalog.getWork = vi.fn(async () => null);
    repositories.reader.getPassageContext = vi.fn(async () => null);
    repositories.knowledge.getEntityProfile = vi.fn(async () => null);
    const services = createApplicationServices(repositories);

    await expect(services.library.openWork(workId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(services.reader.readPassage(passageId)).rejects.toThrow(
      "Passage not found",
    );
    await expect(services.knowledge.openEntity(entityId)).rejects.toThrow(
      "Entity not found",
    );
  });

  it("exposes a named contract mismatch domain error", () => {
    expect(new ContractMismatchError("wrong contract").name).toBe(
      "ContractMismatchError",
    );
  });
});
