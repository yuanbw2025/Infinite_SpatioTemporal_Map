import type {
  AtlasQuery,
  DataContext,
  DatasetOverview,
  EditionId,
  EntityId,
  EntityProfile,
  EntityQuery,
  EntitySummary,
  KnowledgeGraphQuery,
  KnowledgeGraphResult,
  Page,
  Passage,
  PassageContext,
  PassageId,
  PassageQuery,
  ResearchQuery,
  ResearchReport,
  SearchHit,
  SearchQuery,
  TimelineQuery,
  TimelineResult,
  Volume,
  Work,
  WorkDetails,
  WorkId,
  WorkQuery,
} from "@infinite-spacetime/contracts";
import type { PublicationReadPort } from "@infinite-spacetime/ports";
import { exploreAtlas } from "./atlas-use-case";
import { listVolumes, listWorks, openWork } from "./catalog-use-cases";
import { exploreGraph } from "./graph-use-case";
import { listEntities, openEntity } from "./knowledge-use-cases";
import { getDatasetOverview } from "./metrics-use-case";
import { PublicationIndex } from "./publication-index";
import { readPassage, listPassages } from "./reader-use-cases";
import { inspectResearch } from "./research-use-case";
import { search } from "./search-use-case";
import { buildTimeline } from "./timeline-use-case";

export interface ApplicationServices {
  readonly dataContext: DataContext;
  readonly library: {
    listWorks(query?: WorkQuery): Promise<Page<Work>>;
    openWork(id: WorkId): Promise<WorkDetails>;
    listVolumes(editionId: EditionId): Promise<readonly Volume[]>;
  };
  readonly reader: {
    listPassages(query: PassageQuery): Promise<Page<Passage>>;
    readPassage(id: PassageId): Promise<PassageContext>;
  };
  readonly knowledge: {
    listEntities(query?: EntityQuery): Promise<Page<EntitySummary>>;
    openEntity(id: EntityId): Promise<EntityProfile>;
  };
  readonly atlas: {
    explore(query: AtlasQuery): Promise<ReturnType<typeof exploreAtlas>>;
  };
  readonly search: { run(query: SearchQuery): Promise<Page<SearchHit>> };
  readonly metadata: { overview(): Promise<DatasetOverview> };
  readonly graph: {
    explore(query?: KnowledgeGraphQuery): Promise<KnowledgeGraphResult>;
  };
  readonly timeline: { build(query?: TimelineQuery): Promise<TimelineResult> };
  readonly research: {
    inspect(query?: ResearchQuery): Promise<ResearchReport>;
  };
}

/** Composition of use cases around one immutable publication and one shared index. */
export function createApplicationServices(
  port: PublicationReadPort,
): ApplicationServices {
  const index = new PublicationIndex(port.readPublication());
  return {
    dataContext: port.dataContext,
    library: {
      listWorks: async (query) => listWorks(index, query),
      openWork: async (id) => openWork(index, id),
      listVolumes: async (editionId) => listVolumes(index, editionId),
    },
    reader: {
      listPassages: async (query) => listPassages(index, query),
      readPassage: async (id) => readPassage(index, id),
    },
    knowledge: {
      listEntities: async (query) => listEntities(index, query),
      openEntity: async (id) => openEntity(index, id),
    },
    atlas: { explore: async (query) => exploreAtlas(index, query) },
    search: { run: async (query) => search(index, query) },
    metadata: { overview: async () => getDatasetOverview(index) },
    graph: { explore: async (query) => exploreGraph(index, query) },
    timeline: { build: async (query) => buildTimeline(index, query) },
    research: { inspect: async (query) => inspectResearch(index, query) },
  };
}
