import type {
  AtlasQuery,
  DataContext,
  EditionId,
  EntityId,
  EntityQuery,
  KnowledgeGraphQuery,
  PassageId,
  PassageQuery,
  SearchQuery,
  ResearchQuery,
  TimelineQuery,
  WorkId,
  WorkQuery,
} from "@infinite-spacetime/contracts";
import { NotFoundError } from "../domain/errors";
import type { RepositoryBundle } from "./repositories";

export interface ApplicationServices {
  /** Exact publication identity used by every service below. */
  readonly dataContext: DataContext;
  readonly library: {
    listWorks(
      query?: WorkQuery,
    ): ReturnType<RepositoryBundle["catalog"]["listWorks"]>;
    openWork(
      id: WorkId,
    ): Promise<import("@infinite-spacetime/contracts").WorkDetails>;
    listVolumes(
      editionId: EditionId,
    ): ReturnType<RepositoryBundle["catalog"]["listVolumes"]>;
  };
  readonly reader: {
    listPassages(
      query: PassageQuery,
    ): ReturnType<RepositoryBundle["reader"]["listPassages"]>;
    readPassage(
      id: PassageId,
    ): Promise<
      NonNullable<
        Awaited<ReturnType<RepositoryBundle["reader"]["getPassageContext"]>>
      >
    >;
  };
  readonly knowledge: {
    listEntities(
      query?: EntityQuery,
    ): ReturnType<RepositoryBundle["knowledge"]["listEntities"]>;
    openEntity(
      id: EntityId,
    ): Promise<
      NonNullable<
        Awaited<ReturnType<RepositoryBundle["knowledge"]["getEntityProfile"]>>
      >
    >;
  };
  readonly atlas: {
    explore(
      query: AtlasQuery,
    ): ReturnType<RepositoryBundle["atlas"]["exploreAtlas"]>;
  };
  readonly search: {
    run(query: SearchQuery): ReturnType<RepositoryBundle["search"]["search"]>;
  };
  readonly metadata: {
    overview(): ReturnType<RepositoryBundle["metadata"]["getDatasetOverview"]>;
  };
  readonly graph: {
    explore(
      query?: KnowledgeGraphQuery,
    ): ReturnType<RepositoryBundle["graph"]["exploreGraph"]>;
  };
  readonly timeline: {
    build(
      query?: TimelineQuery,
    ): ReturnType<RepositoryBundle["timeline"]["buildTimeline"]>;
  };
  readonly research: {
    inspect(
      query?: ResearchQuery,
    ): ReturnType<RepositoryBundle["research"]["inspectResearch"]>;
  };
}

/** The single application façade consumed by every presentation surface. */
export function createApplicationServices(
  repositories: RepositoryBundle,
): ApplicationServices {
  return {
    dataContext: repositories.dataContext,
    library: {
      listWorks: (query) => repositories.catalog.listWorks(query),
      async openWork(id) {
        const work = await repositories.catalog.getWork(id);
        if (!work) throw new NotFoundError("Work", id);
        const editions = await repositories.catalog.listEditions(id);
        const sourceIds = [
          ...new Set([
            ...work.sourceRefs.map((reference) => reference.sourceId),
            ...editions.flatMap((edition) =>
              edition.sourceRefs.map((reference) => reference.sourceId),
            ),
          ]),
        ];
        return {
          work,
          editions,
          sources: await repositories.catalog.listSources(sourceIds),
        };
      },
      listVolumes: (editionId) => repositories.catalog.listVolumes(editionId),
    },
    reader: {
      listPassages: (query) => repositories.reader.listPassages(query),
      async readPassage(id) {
        const context = await repositories.reader.getPassageContext(id);
        if (!context) throw new NotFoundError("Passage", id);
        return context;
      },
    },
    knowledge: {
      listEntities: (query) => repositories.knowledge.listEntities(query),
      async openEntity(id) {
        const profile = await repositories.knowledge.getEntityProfile(id);
        if (!profile) throw new NotFoundError("Entity", id);
        return profile;
      },
    },
    atlas: {
      explore: (query) => repositories.atlas.exploreAtlas(query),
    },
    search: {
      run: (query) => repositories.search.search(query),
    },
    metadata: {
      overview: () => repositories.metadata.getDatasetOverview(),
    },
    graph: {
      explore: (query) => repositories.graph.exploreGraph(query),
    },
    timeline: {
      build: (query) => repositories.timeline.buildTimeline(query),
    },
    research: {
      inspect: (query) => repositories.research.inspectResearch(query),
    },
  };
}
