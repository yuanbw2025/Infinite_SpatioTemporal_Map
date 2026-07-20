import type {
  AtlasQuery,
  HistoricalGeometry,
} from "@infinite-spacetime/contracts";

export function intersectsBounds(
  historicalGeometry: HistoricalGeometry,
  query: AtlasQuery,
): boolean {
  const shape = historicalGeometry.geometry;
  const positions =
    shape.type === "Point"
      ? [shape.coordinates]
      : shape.type === "Polygon"
        ? shape.coordinates.flatMap((ring) => ring)
        : shape.coordinates.flatMap((polygon) =>
            polygon.flatMap((ring) => ring),
          );
  if (!positions.length) return false;
  const longitudes = positions.map((position) => position[0]);
  const latitudes = positions.map((position) => position[1]);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  if (query.west !== undefined && east < query.west) return false;
  if (query.east !== undefined && west > query.east) return false;
  if (query.south !== undefined && north < query.south) return false;
  if (query.north !== undefined && south > query.north) return false;
  return true;
}
