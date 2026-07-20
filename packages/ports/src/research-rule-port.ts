import type {
  DataContext,
  KnowledgePublication,
  ResearchFinding,
  ResearchQuery,
} from "@infinite-spacetime/contracts";

export interface ResearchRuleRequest {
  readonly dataContext: DataContext;
  readonly publication: KnowledgePublication;
  readonly query: ResearchQuery;
}

/** Trusted, read-only extension point. Implementations may report but never mutate facts. */
export interface ResearchRulePort {
  readonly id: string;
  inspect(request: ResearchRuleRequest): Promise<readonly ResearchFinding[]>;
}
