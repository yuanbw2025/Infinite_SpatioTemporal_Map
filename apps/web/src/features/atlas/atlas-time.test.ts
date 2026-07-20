import type { MapObservation } from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import {
  buildTemporalQuery,
  civilFromDay,
  dayFromCivil,
  rangeTick,
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

  it("round-trips proleptic Gregorian days across eras", () => {
    for (const value of [
      { year: 2026, month: 7, day: 20 },
      { year: 1, month: 1, day: 1 },
      { year: 0, month: 12, day: 31 },
      { year: -221, month: 3, day: 4 },
    ]) {
      expect(
        civilFromDay(dayFromCivil(value.year, value.month, value.day)),
      ).toEqual(value);
    }
    expect(rangeTick(2024, "day", "start")).toBe(dayFromCivil(2024, 1, 1));
    expect(rangeTick(2024, "day", "end")).toBe(dayFromCivil(2024, 12, 31));
    expect(
      buildTemporalQuery({
        currentTick: dayFromCivil(2024, 2, 29),
        resolution: "day",
        startYear: 2024,
        endYear: 2024,
      }),
    ).toMatchObject({
      startYear: 2024,
      startMonth: 2,
      startDay: 29,
      endDay: 29,
      calendar: "proleptic_gregorian",
    });
  });
});
