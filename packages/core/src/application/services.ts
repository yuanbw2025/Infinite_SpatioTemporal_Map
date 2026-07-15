import type {
  AtlasQuery,
  EntityId,
  PageRequest,
  PassageId,
  SearchQuery,
  WorkId,
} from "@infinite-spacetime/contracts";
import { NotFoundError } from "../domain/errors";
import type { RepositoryBundle } from "./repositories";

export interface ApplicationServices {
  readonly library: {
    listWorks(
      request?: PageRequest,
    ): ReturnType<RepositoryBundle["catalog"]["listWorks"]>;
    openWork(id: WorkId): Promise<{
      work: NonNullable<
        Awaited<ReturnType<RepositoryBundle["catalog"]["getWork"]>>
      >;
      editions: Awaited<
        ReturnType<RepositoryBundle["catalog"]["listEditions"]>
      >;
    }>;
  };
  readonly reader: {
    readPassage(
      id: PassageId,
    ): Promise<
      NonNullable<Awaited<ReturnType<RepositoryBundle["reader"]["getPassage"]>>>
    >;
  };
  readonly knowledge: {
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
}

/** The single application façade consumed by every presentation surface. */
export function createApplicationServices(
  repositories: RepositoryBundle,
): ApplicationServices {
  return {
    library: {
      listWorks: (request) => repositories.catalog.listWorks(request),
      async openWork(id) {
        const work = await repositories.catalog.getWork(id);
        if (!work) throw new NotFoundError("Work", id);
        return {
          work,
          editions: await repositories.catalog.listEditions(id),
        };
      },
    },
    reader: {
      async readPassage(id) {
        const passage = await repositories.reader.getPassage(id);
        if (!passage) throw new NotFoundError("Passage", id);
        return passage;
      },
    },
    knowledge: {
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
  };
}
