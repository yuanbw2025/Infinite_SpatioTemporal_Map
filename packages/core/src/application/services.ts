import type {
  AtlasQuery,
  EditionId,
  EntityId,
  EntityQuery,
  PassageId,
  PassageQuery,
  SearchQuery,
  WorkId,
  WorkQuery,
} from "@infinite-spacetime/contracts";
import { NotFoundError } from "../domain/errors";
import type { RepositoryBundle } from "./repositories";

export interface ApplicationServices {
  readonly library: {
    listWorks(
      query?: WorkQuery,
    ): ReturnType<RepositoryBundle["catalog"]["listWorks"]>;
    openWork(id: WorkId): Promise<{
      work: NonNullable<
        Awaited<ReturnType<RepositoryBundle["catalog"]["getWork"]>>
      >;
      editions: Awaited<
        ReturnType<RepositoryBundle["catalog"]["listEditions"]>
      >;
    }>;
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
}

/** The single application façade consumed by every presentation surface. */
export function createApplicationServices(
  repositories: RepositoryBundle,
): ApplicationServices {
  return {
    library: {
      listWorks: (query) => repositories.catalog.listWorks(query),
      async openWork(id) {
        const work = await repositories.catalog.getWork(id);
        if (!work) throw new NotFoundError("Work", id);
        return {
          work,
          editions: await repositories.catalog.listEditions(id),
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
  };
}
