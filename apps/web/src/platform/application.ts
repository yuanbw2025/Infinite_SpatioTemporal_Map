import {
  createEmptyPublication,
  createIiifPresentationImageAdapter,
  createStaticHistoricalMapResourceAdapter,
  createStaticPublicationSource,
} from "@infinite-spacetime/adapters";
import {
  createApplicationServices,
  type ApplicationServices,
} from "@infinite-spacetime/application";
import type {
  DatasetOverview,
  DataContext,
  KnowledgePublication,
} from "@infinite-spacetime/contracts";
import {
  ContractValidationError,
  parseKnowledgePublication,
} from "@infinite-spacetime/contracts";
import type { InjectionKey } from "vue";

export type DataLoadStatus = "ready" | "empty" | "error";

export interface ApplicationRuntime {
  readonly services: ApplicationServices;
  readonly dataContext: DataContext;
  readonly overview: DatasetOverview;
  readonly status: DataLoadStatus;
  readonly sourceUrl: string;
  readonly errorMessage?: string;
  readonly mapResourceWarning?: string;
}

function hasRecords(overview: DatasetOverview): boolean {
  return Object.values(overview.counts).some((count) => count > 0);
}

async function buildRuntime(
  publication: KnowledgePublication,
  sourceUrl: string,
  errorMessage?: string,
  mapResourceCatalog?: unknown,
  initialMapResourceWarning?: string,
): Promise<ApplicationRuntime> {
  const publicationSource = createStaticPublicationSource(publication);
  let historicalMapResources;
  let mapResourceWarning = initialMapResourceWarning;
  if (mapResourceCatalog) {
    try {
      historicalMapResources = createStaticHistoricalMapResourceAdapter(
        mapResourceCatalog,
        publicationSource.dataContext,
        publication.sources.map((source) => source.id),
        publication.geometries.map((geometry) => geometry.id),
      );
    } catch (reason) {
      mapResourceWarning =
        reason instanceof Error ? reason.message : "历史地图资源目录无效";
    }
  }
  const services = createApplicationServices(publicationSource, {
    facsimileImages: createIiifPresentationImageAdapter(async (input, init) =>
      fetch(input, init),
    ),
    ...(historicalMapResources ? { historicalMapResources } : {}),
  });
  const overview = await services.metadata.overview();
  return {
    services,
    dataContext: services.dataContext,
    overview,
    status: errorMessage ? "error" : hasRecords(overview) ? "ready" : "empty",
    sourceUrl,
    ...(errorMessage ? { errorMessage } : {}),
    ...(mapResourceWarning ? { mapResourceWarning } : {}),
  };
}

async function loadMapResourceCatalog(): Promise<unknown | undefined> {
  const url = `${import.meta.env.BASE_URL}data/map-resources.json`;
  const response = await fetch(url, { cache: "no-cache" });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`历史地图资源服务返回 ${response.status}`);
  return response.json();
}

export async function initializeApplicationRuntime(): Promise<ApplicationRuntime> {
  const sourceUrl = `${import.meta.env.BASE_URL}data/publication.json`;
  try {
    const response = await fetch(sourceUrl, { cache: "no-cache" });
    if (response.status === 404) {
      return buildRuntime(createEmptyPublication(), sourceUrl);
    }
    if (!response.ok) {
      throw new Error(`数据服务返回 ${response.status}`);
    }
    const data: unknown = await response.json();
    const publication = parseKnowledgePublication(data);
    let mapResourceCatalog: unknown | undefined;
    let mapResourceWarning: string | undefined;
    try {
      mapResourceCatalog = await loadMapResourceCatalog();
    } catch (reason) {
      mapResourceCatalog = undefined;
      mapResourceWarning =
        reason instanceof Error ? reason.message : "历史地图资源加载失败";
    }
    return await buildRuntime(
      publication,
      sourceUrl,
      undefined,
      mapResourceCatalog,
      mapResourceWarning,
    );
  } catch (error) {
    const message =
      error instanceof ContractValidationError
        ? `数据发布包不符合当前契约：${error.message}`
        : error instanceof Error
          ? error.message
          : "未知加载错误";
    return buildRuntime(
      createEmptyPublication(),
      sourceUrl,
      `数据加载失败：${message}`,
    );
  }
}

export const applicationRuntimeKey: InjectionKey<ApplicationRuntime> = Symbol(
  "infinite-spacetime-application-runtime",
);
