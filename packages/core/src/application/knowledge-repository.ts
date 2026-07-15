import type {
  Assertion,
  Entity,
  EntityId,
  Passage,
  PassageId,
} from "@infinite-spacetime/contracts";

export interface KnowledgeRepository {
  getPassage(id: PassageId): Promise<Passage | null>;
  getEntity(id: EntityId): Promise<Entity | null>;
  findAssertionsByEntity(id: EntityId): Promise<readonly Assertion[]>;
  searchPassages(query: string): Promise<readonly Passage[]>;
}
