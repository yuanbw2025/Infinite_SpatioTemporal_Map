import type {
  DataContext,
  KnowledgePublication,
} from "@infinite-spacetime/contracts";

/** Immutable publication boundary. Adapters may load from static JSON, HTTP, or a database snapshot. */
export interface PublicationReadPort {
  readonly dataContext: DataContext;
  readPublication(): KnowledgePublication;
}
