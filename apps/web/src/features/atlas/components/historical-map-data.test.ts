import type { MapObservation } from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import {
  mutableGeometry,
  observationCollections,
  observationKey,
  routeCollection,
  selectionCollection,
} from "./historical-map-data";

const point = {
  entityId: "person-1",
  placeId: "place-1",
  geometryId: "geometry-1",
  occurrenceId: "occurrence-1",
  geometry: { type: "Point", coordinates: [110, 30] },
  label: "云川",
  category: "person",
} as unknown as MapObservation;
const region = {
  ...point,
  occurrenceId: undefined,
  geometryId: "geometry-2",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [109, 29],
        [111, 31],
      ],
    ],
  },
} as unknown as MapObservation;

describe("historical map data", () => {
  it("creates stable keys and separates point and region sources", () => {
    expect(observationKey(point)).toBe("geometry-1:occurrence-1");
    expect(observationKey(region)).toBe("geometry-2:person-1");
    const collections = observationCollections([point, region]);
    expect(collections.points.features).toHaveLength(1);
    expect(collections.regions.features).toHaveLength(1);
    expect(collections.points.features[0]?.properties.label).toBe("云川");
  });

  it("creates routes and selections without mutating contract geometry", () => {
    expect(mutableGeometry(point)).not.toBe(point.geometry);
    expect(routeCollection([point]).features).toHaveLength(0);
    expect(
      routeCollection([
        point,
        { ...point, geometryId: "g-2" } as unknown as MapObservation,
      ]).features,
    ).toHaveLength(1);
    expect(selectionCollection(undefined).features).toHaveLength(0);
    expect(selectionCollection(region).features[0]?.geometry.type).toBe(
      "Polygon",
    );
  });
});
