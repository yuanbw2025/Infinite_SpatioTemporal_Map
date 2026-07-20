import type {
  HistoricalMapResource,
  HistoricalMapResourceCatalog,
} from "@infinite-spacetime/contracts";

/** Reads a version-bound projection catalog, never canonical map facts. */
export interface HistoricalMapResourcePort {
  readonly catalog: HistoricalMapResourceCatalog;
  list(): Promise<readonly HistoricalMapResource[]>;
}
