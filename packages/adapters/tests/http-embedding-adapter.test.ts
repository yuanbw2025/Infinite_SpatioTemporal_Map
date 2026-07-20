import { describe, expect, it, vi } from "vitest";
import { createHttpEmbeddingAdapter } from "../src";

const configuration = {
  endpoint: "/api/embedding",
  modelId: "local-model",
  dimensions: 2,
};

describe("HTTP embedding adapter", () => {
  it("posts model and text through a credential-free proxy contract", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ vector: [0.5, 0.25] }),
    }));
    const embedding = createHttpEmbeddingAdapter(configuration, fetcher);
    await expect(embedding.embed("山川")).resolves.toEqual([0.5, 0.25]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/embedding",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ model: "local-model", text: "山川" }),
      }),
    );
  });

  it("reports proxy failures and every malformed response branch", async () => {
    const failure = createHttpEmbeddingAdapter(configuration, async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    await expect(failure.embed("山川")).rejects.toThrow("503");
    for (const value of [null, [], "invalid", {}, { vector: "invalid" }]) {
      const malformed = createHttpEmbeddingAdapter(configuration, async () => ({
        ok: true,
        status: 200,
        json: async () => value,
      }));
      await expect(malformed.embed("山川")).rejects.toThrow("缺少 vector");
    }
  });
});
