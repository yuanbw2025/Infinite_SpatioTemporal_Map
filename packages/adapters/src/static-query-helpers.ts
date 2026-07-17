import type {
  AtlasQuery,
  HistoricalGeometry,
  Page,
  PageRequest,
  PlaceIdentity,
  TemporalValue,
} from "@infinite-spacetime/contracts";

export function paginate<T>(
  items: readonly T[],
  request: PageRequest = {},
): Page<T> {
  const start = Number.parseInt(request.cursor ?? "0", 10) || 0;
  const limit = Math.min(Math.max(request.limit ?? 50, 1), 200);
  const pageItems = items.slice(start, start + limit);
  const next = start + pageItems.length;
  return next < items.length
    ? { items: pageItems, nextCursor: String(next) }
    : { items: pageItems };
}

export function groupBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, readonly T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function temporalOrdinal(
  value: TemporalValue | undefined,
  boundary: "start" | "end",
): number | undefined {
  if (!value) return undefined;
  const year =
    boundary === "start"
      ? (value.startYear ?? value.endYear)
      : (value.endYear ?? value.startYear);
  if (year === undefined) return undefined;
  const month =
    boundary === "start" ? (value.startMonth ?? 1) : (value.endMonth ?? 12);
  const day =
    boundary === "start" ? (value.startDay ?? 1) : (value.endDay ?? 31);
  return year * 372 + (month - 1) * 31 + (day - 1);
}

export function overlaps(
  candidate: TemporalValue | undefined,
  requested: TemporalValue | undefined,
): boolean {
  if (!requested || !candidate) return true;
  const candidateStart = temporalOrdinal(candidate, "start");
  const candidateEnd = temporalOrdinal(candidate, "end");
  const requestedStart = temporalOrdinal(requested, "start");
  const requestedEnd = temporalOrdinal(requested, "end");
  if (
    candidateStart === undefined ||
    candidateEnd === undefined ||
    requestedStart === undefined ||
    requestedEnd === undefined
  ) {
    return true;
  }
  return candidateEnd >= requestedStart && candidateStart <= requestedEnd;
}

export function historicalNameAt(
  place: PlaceIdentity,
  temporal: TemporalValue | undefined,
  fallbackName: string,
): string {
  if (!temporal) return fallbackName;
  const matching = place.historicalNames
    .filter((name) => overlaps(name.validDuring, temporal))
    .toSorted(
      (left, right) =>
        (temporalOrdinal(right.validDuring, "start") ??
          Number.MIN_SAFE_INTEGER) -
        (temporalOrdinal(left.validDuring, "start") ?? Number.MIN_SAFE_INTEGER),
    );
  return matching[0]?.name ?? fallbackName;
}

export function overlapsYears(
  candidate:
    { readonly startYear?: number; readonly endYear?: number } | undefined,
  startYear: number | undefined,
  endYear: number | undefined,
): boolean {
  if (startYear === undefined && endYear === undefined) return true;
  if (!candidate) return false;
  const candidateStart = candidate.startYear ?? candidate.endYear;
  const candidateEnd = candidate.endYear ?? candidate.startYear;
  if (candidateStart === undefined || candidateEnd === undefined) return false;
  if (startYear !== undefined && candidateEnd < startYear) return false;
  if (endYear !== undefined && candidateStart > endYear) return false;
  return true;
}

export function boundedLimit(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  return Math.min(Math.max(value ?? fallback, 1), maximum);
}

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
