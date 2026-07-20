import type {
  AtlasQuery,
  DataContext,
  DatasetOverview,
  EditionComparisonQuery,
  EditionComparisonResult,
  EditionId,
  EntityId,
  EntityProfile,
  EntityQuery,
  EntitySummary,
  KnowledgeGraphQuery,
  KnowledgeGraphResult,
  FacsimileImageResource,
  FacsimilePage,
  HistoricalMapResource,
  HistoricalMapResourceQuery,
  HeritageQuery,
  HeritageRecord,
  Page,
  Passage,
  PassageContext,
  PassageId,
  PassageQuery,
  ResearchQuery,
  ResearchReport,
  SourceId,
  SourceProvenance,
  SocietyQuery,
  SocietyResult,
  SearchHit,
  SearchQuery,
  SearchResult,
  TimelineQuery,
  TimelineResult,
  Volume,
  Work,
  WorkDetails,
  WorkId,
  WorkQuery,
} from "@infinite-spacetime/contracts";
import type {
  FacsimileImagePort,
  HistoricalMapResourcePort,
  PublicationReadPort,
  ResearchRulePort,
  SearchIndexPort,
  SemanticSearchPort,
  SpatialQueryPort,
} from "@infinite-spacetime/ports";
import { exploreAtlas } from "./atlas-use-case";
import { listVolumes, listWorks, openWork } from "./catalog-use-cases";
import { compareEditions } from "./edition-comparison-use-case";
import { exploreGraph } from "./graph-use-case";
import { listHistoricalMapResources } from "./historical-map-resource-use-case";
import { listEntities, openEntity } from "./knowledge-use-cases";
import { getDatasetOverview } from "./metrics-use-case";
import { PublicationIndex } from "./publication-index";
import { readPassage, listPassages } from "./reader-use-cases";
import { inspectResearch } from "./research-use-case";
import { executeSearch } from "./semantic-search-use-case";
import { openSourceProvenance } from "./source-provenance-use-case";
import { buildTimeline } from "./timeline-use-case";
import { exploreHeritage, exploreSociety } from "./thematic-use-cases";

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
    compareEditions(
      query: EditionComparisonQuery,
    ): Promise<EditionComparisonResult>;
    resolveFacsimile(
      page: FacsimilePage,
    ): Promise<FacsimileImageResource | undefined>;
  };
  readonly knowledge: {
    listEntities(query?: EntityQuery): Promise<Page<EntitySummary>>;
    openEntity(id: EntityId): Promise<EntityProfile>;
  };
  readonly provenance: {
    openSource(sourceId: SourceId, depth?: number): Promise<SourceProvenance>;
  };
  readonly society: {
    explore(query?: SocietyQuery): Promise<SocietyResult>;
  };
  readonly heritage: {
    explore(query?: HeritageQuery): Promise<Page<HeritageRecord>>;
  };
  readonly atlas: {
    explore(query: AtlasQuery): Promise<ReturnType<typeof exploreAtlas>>;
    listMapResources(
      query?: HistoricalMapResourceQuery,
    ): Promise<readonly HistoricalMapResource[]>;
  };
  readonly search: { run(query: SearchQuery): Promise<SearchResult> };
  readonly metadata: { overview(): Promise<DatasetOverview> };
  readonly graph: {
    explore(query?: KnowledgeGraphQuery): Promise<KnowledgeGraphResult>;
  };
  readonly timeline: { build(query?: TimelineQuery): Promise<TimelineResult> };
  readonly research: {
    inspect(query?: ResearchQuery): Promise<ResearchReport>;
  };
}

export interface ApplicationDependencies {
  readonly facsimileImages?: FacsimileImagePort;
  readonly historicalMapResources?: HistoricalMapResourcePort;
  readonly searchIndex?: SearchIndexPort;
  readonly semanticSearch?: SemanticSearchPort;
  readonly spatialQuery?: SpatialQueryPort;
  readonly researchRules?: readonly ResearchRulePort[];
}

/** Composition of use cases around one immutable publication and one shared index. */
export function createApplicationServices(
  port: PublicationReadPort,
  dependencies: ApplicationDependencies = {},
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
      compareEditions: async (query) => compareEditions(index, query),
      resolveFacsimile: async (page) => {
        if (page.imageUrl) {
          return {
            imageUrl: page.imageUrl,
            ...(page.canvasUrl ? { canvasUrl: page.canvasUrl } : {}),
            ...(page.width ? { width: page.width } : {}),
            ...(page.height ? { height: page.height } : {}),
            source: "direct",
          };
        }
        return page.canvasUrl && dependencies.facsimileImages
          ? dependencies.facsimileImages.resolveCanvas(page.canvasUrl)
          : undefined;
      },
    },
    knowledge: {
      listEntities: async (query) => listEntities(index, query),
      openEntity: async (id) => openEntity(index, id),
    },
    provenance: {
      openSource: async (sourceId, depth) =>
        openSourceProvenance(index, {
          sourceId,
          ...(depth === undefined ? {} : { depth }),
        }),
    },
    society: { explore: async (query) => exploreSociety(index, query) },
    heritage: { explore: async (query) => exploreHeritage(index, query) },
    atlas: {
      explore: async (query) =>
        dependencies.spatialQuery
          ? dependencies.spatialQuery.explore(query)
          : exploreAtlas(index, query),
      listMapResources: async (query) =>
        listHistoricalMapResources(
          dependencies.historicalMapResources
            ? await dependencies.historicalMapResources.list()
            : [],
          query,
        ),
    },
    search: {
      run: async (query) =>
        executeSearch(
          index,
          port.dataContext,
          query,
          dependencies.searchIndex,
          dependencies.semanticSearch,
        ),
    },
    metadata: { overview: async () => getDatasetOverview(index) },
    graph: { explore: async (query) => exploreGraph(index, query) },
    timeline: { build: async (query) => buildTimeline(index, query) },
    research: {
      inspect: async (query) =>
        inspectResearch(
          index,
          port.dataContext,
          query,
          dependencies.researchRules ?? [],
        ),
    },
  };
}
