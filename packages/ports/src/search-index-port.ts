import type {
  Page,
  SearchHit,
  SearchQuery,
} from "@infinite-spacetime/contracts";

/** Optional scalable full-text/semantic implementation of the canonical search use case. */
export interface SearchIndexPort {
  search(query: SearchQuery): Promise<Page<SearchHit>>;
}
