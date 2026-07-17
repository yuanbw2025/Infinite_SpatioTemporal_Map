import type { Assertion } from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";

import { validateAssertion } from "../src";

describe("assertion validation", () => {
  it("accepts an evidenced entity assertion", () => {
    expect(() =>
      validateAssertion({
        objectId: "entity-b",
        evidence: [{ passageId: "passage-a", start: 0, end: 1 }],
      } as unknown as Assertion),
    ).not.toThrow();
  });

  it("rejects missing evidence and missing values at untrusted boundaries", () => {
    expect(() =>
      validateAssertion({
        objectId: "entity-b",
        evidence: [],
      } as unknown as Assertion),
    ).toThrow("evidence span");
    expect(() =>
      validateAssertion({
        evidence: [{ passageId: "passage-a", start: 0, end: 1 }],
      } as unknown as Assertion),
    ).toThrow("entity object or a literal value");
  });
});
