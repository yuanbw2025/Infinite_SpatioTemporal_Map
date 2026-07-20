import type { HistoricalMapResource } from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import {
  resourceLayerIds,
  resourceSourceId,
} from "./historical-reference-layers";

const raster = {
  id: "ming-map",
  kind: "raster_map",
} as HistoricalMapResource;
const boundary = {
  id: "ming-boundary",
  kind: "boundary_geojson",
} as HistoricalMapResource;

describe("historical reference map layer identity", () => {
  it("creates stable and non-colliding source/layer ids", () => {
    expect(resourceSourceId(raster)).toBe(
      "historical-resource-source-ming-map",
    );
    expect(resourceLayerIds(raster)).toHaveLength(1);
    expect(resourceLayerIds(boundary)).toEqual([
      "historical-resource-layer-ming-boundary-fill",
      "historical-resource-layer-ming-boundary-line",
    ]);
  });
});
