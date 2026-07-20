import type {
  Page,
  PageRequest,
  PlaceIdentity,
  TemporalValue,
} from "@infinite-spacetime/contracts";
import { overlaps, temporalOrdinal } from "@infinite-spacetime/domain";

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

export function boundedLimit(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  return Math.min(Math.max(value ?? fallback, 1), maximum);
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
