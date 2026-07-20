import {
  createEmptyPublication,
  createIiifPresentationImageAdapter,
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
}

function hasRecords(overview: DatasetOverview): boolean {
  return Object.values(overview.counts).some((count) => count > 0);
}

async function buildRuntime(
  publication: KnowledgePublication,
  sourceUrl: string,
  errorMessage?: string,
): Promise<ApplicationRuntime> {
  const services = createApplicationServices(
    createStaticPublicationSource(publication),
    {
      facsimileImages: createIiifPresentationImageAdapter(async (input, init) =>
        fetch(input, init),
      ),
    },
  );
  const overview = await services.metadata.overview();
  return {
    services,
    dataContext: services.dataContext,
    overview,
    status: errorMessage ? "error" : hasRecords(overview) ? "ready" : "empty",
    sourceUrl,
    ...(errorMessage ? { errorMessage } : {}),
  };
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
    return await buildRuntime(parseKnowledgePublication(data), sourceUrl);
  } catch (error) {
    const message =
      error instanceof ContractValidationError
        ? `数据发布包不符合 0.4 契约：${error.message}`
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
