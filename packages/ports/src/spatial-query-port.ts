import type { AtlasQuery, AtlasResult } from "@infinite-spacetime/contracts";

/** Optional database or vector-tile backed implementation of atlas querying. */
export interface SpatialQueryPort {
  explore(query: AtlasQuery): Promise<AtlasResult>;
}
