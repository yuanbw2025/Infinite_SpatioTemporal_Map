import {
  PREDICATE_DEFINITIONS as GENERATED_PREDICATE_DEFINITIONS,
  PREDICATE_VOCABULARY_VERSION,
} from "./generated/predicates";
import type { EntityType } from "./knowledge";

export { PREDICATE_VOCABULARY_VERSION };

type GeneratedPredicate = (typeof GENERATED_PREDICATE_DEFINITIONS)[number];
export type PredicateId = GeneratedPredicate["id"];
export type PredicateCategory = GeneratedPredicate["category"];

export interface PredicateDefinition {
  readonly id: PredicateId;
  readonly label: string;
  readonly category: PredicateCategory;
  readonly valueKind: "entity" | "literal";
  readonly directionality: "directed" | "symmetric";
  readonly inversePredicateId?: PredicateId;
  readonly subjectTypes: readonly EntityType[];
  readonly objectTypes: readonly EntityType[];
}

export const PREDICATE_DEFINITIONS: readonly PredicateDefinition[] =
  GENERATED_PREDICATE_DEFINITIONS;

export const PREDICATE_IDS = PREDICATE_DEFINITIONS.map(
  (definition) => definition.id,
);

const definitions = new Map(
  PREDICATE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function predicateDefinition(id: PredicateId): PredicateDefinition {
  const definition = definitions.get(id);
  if (!definition) throw new Error(`Unknown predicate: ${id}`);
  return definition;
}
