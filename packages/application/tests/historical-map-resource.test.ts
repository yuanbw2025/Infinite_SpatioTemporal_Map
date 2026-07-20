import type { HistoricalMapResource } from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import { listHistoricalMapResources } from "../src/historical-map-resource-use-case";

const resources = [
  {
    id: "ming-map",
    title: "明代图",
    kind: "boundary_geojson",
    dataUrl: "/ming.geojson",
    geometryIds: ["geometry-ming"],
    validDuring: {
      original: "明",
      startYear: 1368,
      endYear: 1644,
      certainty: "range",
    },
    defaultOpacity: 0.4,
    isDefault: true,
  },
  {
    id: "qing-map",
    title: "清代图",
    kind: "boundary_geojson",
    dataUrl: "/qing.geojson",
    geometryIds: ["geometry-qing"],
    validDuring: {
      original: "清",
      startYear: 1644,
      endYear: 1912,
      certainty: "range",
    },
    defaultOpacity: 0.4,
    isDefault: true,
  },
] as unknown as readonly HistoricalMapResource[];

describe("historical map resource use case", () => {
  it("selects resources with the same temporal overlap rule as map facts", () => {
    expect(
      listHistoricalMapResources(resources, {
        temporal: {
          original: "万历",
          startYear: 1600,
          endYear: 1600,
          certainty: "exact",
        },
      }).map((item) => item.id),
    ).toEqual(["ming-map"]);
  });
});
