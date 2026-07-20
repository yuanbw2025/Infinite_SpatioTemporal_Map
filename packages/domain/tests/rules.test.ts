import type {
  Assertion,
  EntityId,
  Mention,
  MentionId,
  Passage,
  PassageId,
  VolumeId,
} from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import {
  ContractMismatchError,
  DomainError,
  intersectsBounds,
  NotFoundError,
  overlaps,
  overlapsYears,
  temporalOrdinal,
  validateAssertion,
  validateMention,
} from "../src";

const passageId = "passage-1" as PassageId;
const temporal = (value: Record<string, number> = {}) =>
  ({ original: "test", certainty: "exact", ...value }) as const;
const passage: Passage = {
  id: passageId,
  volumeId: "volume-1" as VolumeId,
  sequence: 0,
  text: { original: "建康古名金陵。" },
  facsimileAnchors: [],
  revision: 1,
};
const mention: Mention = {
  id: "mention-1" as MentionId,
  passageId,
  entityId: "place-1" as EntityId,
  start: 0,
  end: 2,
  surface: "建康",
  reviewStatus: "reviewed",
};

describe("domain invariants", () => {
  it("protects immutable mention coordinates", () => {
    expect(() => validateMention(passage, mention)).not.toThrow();
    expect(() =>
      validateMention(passage, { ...mention, surface: "南京" }),
    ).toThrow("immutable original text");
    expect(() =>
      validateMention(passage, { ...mention, passageId: "other" as PassageId }),
    ).toThrow("identifiers");
    expect(() =>
      validateMention(passage, { ...mention, start: 2, end: 2 }),
    ).toThrow("range");
  });

  it("protects evidence-first assertions", () => {
    expect(() =>
      validateAssertion({
        predicate: "other.related_to",
        objectId: "entity-b",
        evidence: [{ passageId, start: 0, end: 1 }],
      } as unknown as Assertion),
    ).not.toThrow();
    expect(() =>
      validateAssertion({
        predicate: "other.related_to",
        objectId: "entity-b",
        evidence: [],
      } as unknown as Assertion),
    ).toThrow("evidence span");
    expect(() =>
      validateAssertion({
        predicate: "other.related_to",
        evidence: [{ passageId, start: 0, end: 1 }],
      } as unknown as Assertion),
    ).toThrow("entity object");
    expect(() =>
      validateAssertion({
        predicate: "office.held_title",
        objectId: "entity-b",
        evidence: [{ passageId, start: 0, end: 1 }],
      } as unknown as Assertion),
    ).toThrow("literal value");
  });

  it("uses named domain errors", () => {
    expect(new DomainError("wrong").name).toBe("DomainError");
    expect(new NotFoundError("Passage", "missing")).toMatchObject({
      name: "NotFoundError",
      message: "Passage not found: missing",
    });
    expect(new ContractMismatchError("wrong").name).toBe(
      "ContractMismatchError",
    );
  });

  it("normalizes open temporal boundaries and detects overlap", () => {
    expect(temporalOrdinal(undefined, "start")).toBeUndefined();
    expect(temporalOrdinal(temporal(), "start")).toBeUndefined();
    expect(temporalOrdinal(temporal({ endYear: 200 }), "start")).toBe(
      200 * 372,
    );
    expect(temporalOrdinal(temporal({ startYear: 200 }), "end")).toBe(
      200 * 372 + 371,
    );
    expect(
      temporalOrdinal(
        temporal({ startYear: 200, startMonth: 2, startDay: 3 }),
        "start",
      ),
    ).toBe(200 * 372 + 33);
    expect(overlaps(undefined, temporal({ startYear: 1 }))).toBe(true);
    expect(overlaps(temporal(), temporal({ startYear: 1 }))).toBe(true);
    expect(
      overlaps(
        temporal({ startYear: 10, endYear: 20 }),
        temporal({ startYear: 20 }),
      ),
    ).toBe(true);
    expect(
      overlaps(
        temporal({ startYear: 10, endYear: 19 }),
        temporal({ startYear: 20 }),
      ),
    ).toBe(false);
  });

  it("filters coarse year intervals", () => {
    expect(overlapsYears(undefined, undefined, undefined)).toBe(true);
    expect(overlapsYears(undefined, 1, 2)).toBe(false);
    expect(overlapsYears({}, 1, 2)).toBe(false);
    expect(overlapsYears({ endYear: 5 }, 5, undefined)).toBe(true);
    expect(overlapsYears({ startYear: 5 }, undefined, 5)).toBe(true);
    expect(overlapsYears({ startYear: 1, endYear: 4 }, 5, undefined)).toBe(
      false,
    );
    expect(overlapsYears({ startYear: 6, endYear: 7 }, undefined, 5)).toBe(
      false,
    );
  });

  it("computes bounds for every supported geometry", () => {
    const base = {
      id: "geometry-1",
      placeId: "place-1",
      sourceRefs: [{ sourceId: "source-1" }],
      reviewStatus: "reviewed",
    } as const;
    const point = {
      ...base,
      geometry: { type: "Point", coordinates: [10, 20] },
    } as never;
    const polygon = {
      ...base,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [2, 2],
          ],
        ],
      },
    } as never;
    const multiPolygon = {
      ...base,
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-2, -2],
              [3, 3],
            ],
          ],
        ],
      },
    } as never;
    const empty = {
      ...base,
      geometry: { type: "Polygon", coordinates: [] },
    } as never;

    expect(intersectsBounds(point, {})).toBe(true);
    expect(intersectsBounds(polygon, { west: 3 })).toBe(false);
    expect(intersectsBounds(polygon, { east: -1 })).toBe(false);
    expect(intersectsBounds(multiPolygon, { south: 4 })).toBe(false);
    expect(intersectsBounds(multiPolygon, { north: -3 })).toBe(false);
    expect(
      intersectsBounds(multiPolygon, {
        west: -2,
        east: 3,
        south: -2,
        north: 3,
      }),
    ).toBe(true);
    expect(intersectsBounds(empty, {})).toBe(false);
  });
});
