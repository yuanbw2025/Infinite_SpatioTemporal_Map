import {
  createEmptyPublication,
  createStaticPublicationRepository,
} from "@infinite-spacetime/adapters";
import type {
  DatasetOverview,
  KnowledgePublication,
} from "@infinite-spacetime/contracts";
import {
  createApplicationServices,
  type ApplicationServices,
} from "@infinite-spacetime/core";
import type { InjectionKey } from "vue";

export type DataLoadStatus = "ready" | "empty" | "error";

export interface ApplicationRuntime {
  readonly services: ApplicationServices;
  readonly overview: DatasetOverview;
  readonly status: DataLoadStatus;
  readonly sourceUrl: string;
  readonly errorMessage?: string;
}

function isPublication(value: unknown): value is KnowledgePublication {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<KnowledgePublication>;
  return Boolean(
    candidate.manifest &&
    typeof candidate.manifest.contractVersion === "string" &&
    Array.isArray(candidate.works) &&
    Array.isArray(candidate.editions) &&
    Array.isArray(candidate.volumes) &&
    Array.isArray(candidate.passages) &&
    Array.isArray(candidate.entities) &&
    Array.isArray(candidate.mentions) &&
    Array.isArray(candidate.assertions) &&
    Array.isArray(candidate.places) &&
    Array.isArray(candidate.geometries) &&
    Array.isArray(candidate.occurrences),
  );
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
    createStaticPublicationRepository(publication),
  );
  const overview = await services.metadata.overview();
  return {
    services,
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
    if (!isPublication(data)) {
      return buildRuntime(
        createEmptyPublication(),
        sourceUrl,
        "数据发布包结构不完整，已进入安全空数据模式。",
      );
    }
    return await buildRuntime(data, sourceUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知加载错误";
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
