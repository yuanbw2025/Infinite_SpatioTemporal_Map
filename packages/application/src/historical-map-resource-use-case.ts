import type {
  HistoricalMapResource,
  HistoricalMapResourceQuery,
} from "@infinite-spacetime/contracts";
import { overlaps } from "@infinite-spacetime/domain";

export function listHistoricalMapResources(
  resources: readonly HistoricalMapResource[],
  query: HistoricalMapResourceQuery = {},
): readonly HistoricalMapResource[] {
  return resources
    .filter((resource) => overlaps(resource.validDuring, query.temporal))
    .toSorted((left, right) => left.title.localeCompare(right.title, "zh-CN"));
}
