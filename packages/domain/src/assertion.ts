import {
  predicateDefinition,
  type Assertion,
} from "@infinite-spacetime/contracts";

export function validateAssertion(assertion: Assertion): void {
  if (assertion.evidence.length === 0) {
    throw new Error("Every assertion must include at least one evidence span");
  }
  const hasObject = assertion.objectId !== undefined;
  const hasLiteral = assertion.literalValue !== undefined;
  if (hasObject === hasLiteral) {
    throw new Error(
      "An assertion must have exactly one entity object or literal value",
    );
  }
  const definition = predicateDefinition(assertion.predicate);
  if (definition.valueKind === "entity" && !hasObject) {
    throw new Error(
      `Predicate ${assertion.predicate} requires an entity object`,
    );
  }
  if (definition.valueKind === "literal" && !hasLiteral) {
    throw new Error(
      `Predicate ${assertion.predicate} requires a literal value`,
    );
  }
}
