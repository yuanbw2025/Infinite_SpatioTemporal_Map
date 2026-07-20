import {
  createStaticHistoricalMapResourceAdapter,
  HistoricalMapResourceValidationError,
} from "../src/static-historical-map-resource-adapter";
import type {
  DataContext,
  GeometryId,
  SourceId,
} from "@infinite-spacetime/contracts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const context = {
  contractVersion: "0.8.0",
  publicationId: "publication-a",
  datasetVersion: "0.0.0",
  contentChecksum: `sha256:${"0".repeat(64)}`,
} as DataContext;
const catalog = {
  version: 1,
  publicationId: context.publicationId,
  contentChecksum: context.contentChecksum,
  generatedAt: "1970-01-01T00:00:00Z",
  toolVersion: "test-v1",
  resources: [
    {
      id: "map-a",
      title: "测试历史地图",
      kind: "raster_map",
      tiles: ["https://example.test/{z}/{x}/{y}.png"],
      sourceId: "source-map",
      defaultOpacity: 0.8,
      isDefault: true,
    },
  ],
};
const boundary = {
  id: "boundary-a",
  title: "测试疆域",
  kind: "boundary_geojson",
  dataUrl: "/boundary.geojson",
  geometryIds: ["geometry-a"],
  defaultOpacity: 0.4,
  isDefault: false,
};

function withResources(resources: unknown) {
  return { ...catalog, resources };
}

function rejects(
  value: unknown,
  sources: SourceId[] = [],
  geometries: GeometryId[] = [],
) {
  expect(() =>
    createStaticHistoricalMapResourceAdapter(
      value,
      context,
      sources,
      geometries,
    ),
  ).toThrow(HistoricalMapResourceValidationError);
}

describe("static historical map resource adapter", () => {
  it("accepts a catalog bound to the exact publication and source registry", async () => {
    const adapter = createStaticHistoricalMapResourceAdapter(
      catalog,
      context,
      ["source-map" as SourceId],
      [],
    );
    await expect(adapter.list()).resolves.toHaveLength(1);
  });

  it("rejects a stale catalog or an unknown source", () => {
    expect(() =>
      createStaticHistoricalMapResourceAdapter(
        { ...catalog, contentChecksum: `sha256:${"f".repeat(64)}` },
        context,
        ["source-map" as SourceId],
        [],
      ),
    ).toThrow(HistoricalMapResourceValidationError);
    expect(() =>
      createStaticHistoricalMapResourceAdapter(catalog, context, [], []),
    ).toThrow(/SourceRecord/);
  });

  it("accepts a boundary projection only when every geometry is canonical", async () => {
    const adapter = createStaticHistoricalMapResourceAdapter(
      withResources([boundary]),
      context,
      [],
      ["geometry-a" as GeometryId],
    );
    await expect(adapter.list()).resolves.toEqual([boundary]);
  });

  it("rejects malformed catalog envelopes", () => {
    for (const value of [
      null,
      [],
      { ...catalog, version: 2 },
      { ...catalog, publicationId: "other" },
      { ...catalog, contentChecksum: "other" },
      { ...catalog, generatedAt: 1 },
      { ...catalog, toolVersion: 1 },
      { ...catalog, resources: null },
    ])
      rejects(value);
    rejects(withResources([catalog.resources[0], catalog.resources[0]]), [
      "source-map" as SourceId,
    ]);
  });

  it("rejects malformed common resource fields", () => {
    const base = catalog.resources[0]!;
    for (const resource of [
      null,
      [],
      { ...base, id: 1 },
      { ...base, id: "-bad" },
      { ...base, title: 1 },
      { ...base, title: " " },
      { ...base, defaultOpacity: "1" },
      { ...base, defaultOpacity: -0.1 },
      { ...base, defaultOpacity: 1.1 },
      { ...base, isDefault: "yes" },
      { ...base, sourceId: 1 },
      { ...base, sourceId: "unknown" },
    ])
      rejects(withResources([resource]));
  });

  it("rejects malformed raster and boundary resources", () => {
    const raster = catalog.resources[0]!;
    for (const resource of [
      { ...raster, tiles: null },
      { ...raster, tiles: [] },
      { ...raster, tiles: [1] },
      { ...raster, tiles: [" "] },
      { ...raster, tiles: ["http://["] },
      { ...raster, sourceId: undefined },
    ])
      rejects(withResources([resource]), ["source-map" as SourceId]);
    for (const resource of [
      { ...boundary, kind: "unknown" },
      { ...boundary, dataUrl: "http://[" },
      { ...boundary, geometryIds: null },
      { ...boundary, geometryIds: [] },
      { ...boundary, geometryIds: [1] },
      { ...boundary, geometryIds: ["unknown"] },
    ])
      rejects(withResources([resource]), [], ["geometry-a" as GeometryId]);
  });

  it("keeps the checked-in resource catalog bound to the checked-in publication", async () => {
    const root = new URL("../../../", import.meta.url);
    const publication = JSON.parse(
      readFileSync(
        new URL("apps/web/public/data/publication.json", root),
        "utf8",
      ),
    );
    const checkedCatalog = JSON.parse(
      readFileSync(
        new URL("apps/web/public/data/map-resources.json", root),
        "utf8",
      ),
    );
    const checkedContext = {
      contractVersion: publication.manifest.contractVersion,
      publicationId: publication.manifest.publicationId,
      datasetVersion: publication.manifest.datasetVersion,
      contentChecksum: publication.manifest.contentChecksum,
    } as DataContext;
    const adapter = createStaticHistoricalMapResourceAdapter(
      checkedCatalog,
      checkedContext,
      publication.sources.map((source: { id: SourceId }) => source.id),
      publication.geometries.map((geometry: { id: GeometryId }) => geometry.id),
    );
    await expect(adapter.list()).resolves.toEqual([]);
  });
});
