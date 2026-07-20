import type {
  SemanticSearchCandidate,
  SemanticSearchRequest,
} from "@infinite-spacetime/contracts";

/** Version-aware semantic retrieval returns IDs; application resolves canonical records. */
export interface SemanticSearchPort {
  search(
    request: SemanticSearchRequest,
  ): Promise<readonly SemanticSearchCandidate[]>;
}
