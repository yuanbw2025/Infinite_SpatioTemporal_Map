import type { MapObservation } from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import {
  buildTemporalQuery,
  temporalSortValue,
  yearMonthFromTick,
} from "./atlas-time";

describe("atlas time controller", () => {
  it("builds exact year, exact month, range, and open queries", () => {
    expect(
      buildTemporalQuery({
        currentTick: undefined,
        resolution: "year",
        startYear: undefined,
        endYear: undefined,
      }),
    ).toBeUndefined();
    expect(
      buildTemporalQuery({
        currentTick: 120,
        resolution: "year",
        startYear: 1,
        endYear: 2,
      }),
    ).toMatchObject({ startYear: 120, endYear: 120, certainty: "exact" });
    expect(
      buildTemporalQuery({
        currentTick: 120 * 12 + 3,
        resolution: "month",
        startYear: 1,
        endYear: 2,
      }),
    ).toMatchObject({ startYear: 120, startMonth: 4, certainty: "exact" });
    expect(
      buildTemporalQuery({
        currentTick: undefined,
        resolution: "year",
        startYear: 100,
        endYear: 200,
      }),
    ).toMatchObject({ startYear: 100, endYear: 200, certainty: "range" });
  });

  it("sorts partial dates deterministically", () => {
    expect(yearMonthFromTick(120 * 12 + 11)).toEqual({ year: 120, month: 12 });
    const observation = {
      temporal: { startYear: 120, startMonth: 2, startDay: 3 },
    } as unknown as MapObservation;
    expect(temporalSortValue(observation)).toBe(120 * 372 + 33);
    expect(temporalSortValue({} as MapObservation)).toBe(0);
  });
});
