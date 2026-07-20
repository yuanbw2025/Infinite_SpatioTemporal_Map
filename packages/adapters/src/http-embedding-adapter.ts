import type { EmbeddingPort } from "@infinite-spacetime/ports";

export interface HttpEmbeddingConfiguration {
  readonly endpoint: string;
  readonly modelId: string;
  readonly dimensions: number;
}

interface EmbeddingResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type EmbeddingFetch = (
  input: string,
  init: {
    readonly method: "POST";
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
  },
) => Promise<EmbeddingResponse>;

/** Same-origin proxy adapter; credentials stay on the server, never in Vite env. */
export function createHttpEmbeddingAdapter(
  configuration: HttpEmbeddingConfiguration,
  fetcher: EmbeddingFetch,
): EmbeddingPort {
  return {
    modelId: configuration.modelId,
    dimensions: configuration.dimensions,
    async embed(text) {
      const response = await fetcher(configuration.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: configuration.modelId, text }),
      });
      if (!response.ok) throw new Error(`语义向量服务返回 ${response.status}`);
      const value: unknown = await response.json();
      if (
        !value ||
        typeof value !== "object" ||
        !Array.isArray((value as { vector?: unknown }).vector)
      )
        throw new Error("语义向量服务响应缺少 vector");
      return (value as { vector: number[] }).vector;
    },
  };
}
