import type { Assertion } from "@infinite-spacetime/contracts";

export function validateAssertion(assertion: Assertion): void {
  if (assertion.evidence.length === 0) {
    throw new Error("Every assertion must include at least one evidence span");
  }
  if (
    assertion.objectId === undefined &&
    assertion.literalValue === undefined
  ) {
    throw new Error(
      "An assertion must have an entity object or a literal value",
    );
  }
}
