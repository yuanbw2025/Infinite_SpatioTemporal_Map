import type {
  DataContext,
  SemanticIndexArtifact,
} from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import {
  createStaticSemanticSearchAdapter,
  SemanticIndexValidationError,
} from "../src";

const context = {
  contractVersion: "0.8.0",
  publicationId: "semantic-test",
  datasetVersion: "1.0.0",
  contentChecksum: `sha256:${"1".repeat(64)}`,
} as DataContext;
const embedding = {
  modelId: "test-embedding-v1",
  dimensions: 2,
  embed: async (text: string) => (text === "山川" ? [1, 0] : [0, 1]),
};
const artifact: SemanticIndexArtifact = {
  version: 1,
  publicationId: context.publicationId,
  contentChecksum: context.contentChecksum,
  modelId: embedding.modelId,
  dimensions: 2,
  records: [
    { kind: "passage", id: "passage-1", vector: [1, 0] },
    { kind: "entity", id: "entity-1", vector: [0, 1] },
  ],
};

function create(value: unknown, embedder = embedding) {
  return createStaticSemanticSearchAdapter(value, context, embedder);
}

describe("static semantic search adapter", () => {
  it("ranks canonical references, bounds limits, and handles empty queries", async () => {
    const adapter = create(artifact);
    await expect(
      adapter.search({
        dataContext: context,
        query: { text: "山川", mode: "semantic" },
        limit: 1,
      }),
    ).resolves.toEqual([{ kind: "passage", id: "passage-1", score: 1 }]);
    await expect(
      adapter.search({
        dataContext: context,
        query: { text: "人物" },
        limit: 2_000,
      }),
    ).resolves.toHaveLength(2);
    await expect(
      adapter.search({
        dataContext: context,
        query: { text: "人物" },
        limit: 0,
      }),
    ).resolves.toHaveLength(1);
    await expect(
      adapter.search({
        dataContext: context,
        query: { text: "  " },
        limit: 10,
      }),
    ).resolves.toEqual([]);
    const tied = create({
      ...artifact,
      records: [
        { kind: "work", id: "work-b", vector: [1, 0] },
        { kind: "work", id: "work-a", vector: [1, 0] },
      ],
    });
    await expect(
      tied.search({
        dataContext: context,
        query: { text: "山川" },
        limit: 10,
      }),
    ).resolves.toMatchObject([{ id: "work-a" }, { id: "work-b" }]);
  });

  it("rejects malformed and mismatched artifacts", () => {
    const invalid: unknown[] = [
      null,
      [],
      { ...artifact, version: 2 },
      { ...artifact, publicationId: "other" },
      { ...artifact, contentChecksum: `sha256:${"2".repeat(64)}` },
      { ...artifact, modelId: undefined },
      { ...artifact, modelId: "" },
      { ...artifact, modelId: "other-model" },
      { ...artifact, dimensions: 1.5 },
      { ...artifact, dimensions: 0 },
      { ...artifact, dimensions: 3 },
      { ...artifact, records: null },
      { ...artifact, records: [null] },
      { ...artifact, records: [[]] },
      {
        ...artifact,
        records: [{ kind: "unknown", id: "x", vector: [1, 0] }],
      },
      {
        ...artifact,
        records: [{ kind: "work", id: undefined, vector: [1, 0] }],
      },
      {
        ...artifact,
        records: [{ kind: "work", id: "", vector: [1, 0] }],
      },
      {
        ...artifact,
        records: [
          { kind: "work", id: "x", vector: [1, 0] },
          { kind: "work", id: "x", vector: [0, 1] },
        ],
      },
      {
        ...artifact,
        records: [{ kind: "work", id: "x", vector: null }],
      },
      {
        ...artifact,
        records: [{ kind: "work", id: "x", vector: [1] }],
      },
      {
        ...artifact,
        records: [{ kind: "work", id: "x", vector: ["1", 0] }],
      },
      {
        ...artifact,
        records: [{ kind: "work", id: "x", vector: [Infinity, 0] }],
      },
      {
        ...artifact,
        records: [{ kind: "work", id: "x", vector: [0, 0] }],
      },
    ];
    for (const value of invalid)
      expect(() => create(value)).toThrow(SemanticIndexValidationError);
  });

  it("rejects mismatched query contexts and invalid query embeddings", async () => {
    const adapter = create(artifact);
    await expect(
      adapter.search({
        dataContext: { ...context, publicationId: "other" as never },
        query: { text: "山川" },
        limit: 10,
      }),
    ).rejects.toThrow("another publication");
    await expect(
      adapter.search({
        dataContext: {
          ...context,
          contentChecksum: `sha256:${"3".repeat(64)}`,
        },
        query: { text: "山川" },
        limit: 10,
      }),
    ).rejects.toThrow("another publication");
    const invalidEmbedding = create(artifact, {
      ...embedding,
      embed: async () => [0, 0],
    });
    await expect(
      invalidEmbedding.search({
        dataContext: context,
        query: { text: "山川" },
        limit: 10,
      }),
    ).rejects.toThrow("invalid vector");
  });
});
