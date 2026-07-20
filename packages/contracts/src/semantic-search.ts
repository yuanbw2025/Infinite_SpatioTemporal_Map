import type { EntityId, PassageId, WorkId } from "./ids";
import type { DataContext, SearchQuery } from "./queries";

export type SemanticDocumentReference =
  | { readonly kind: "work"; readonly id: WorkId }
  | { readonly kind: "passage"; readonly id: PassageId }
  | { readonly kind: "entity"; readonly id: EntityId };

export type SemanticSearchCandidate = SemanticDocumentReference & {
  readonly score: number;
};

export interface SemanticSearchRequest {
  readonly dataContext: DataContext;
  readonly query: SearchQuery;
  readonly limit: number;
}

export interface SemanticIndexRecord {
  readonly kind: SemanticDocumentReference["kind"];
  readonly id: string;
  readonly vector: readonly number[];
}

export interface SemanticIndexArtifact {
  readonly version: 1;
  readonly publicationId: DataContext["publicationId"];
  readonly contentChecksum: DataContext["contentChecksum"];
  readonly modelId: string;
  readonly dimensions: number;
  readonly records: readonly SemanticIndexRecord[];
}
