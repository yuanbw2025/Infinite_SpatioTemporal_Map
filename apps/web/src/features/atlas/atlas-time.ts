import type {
  MapObservation,
  TemporalValue,
} from "@infinite-spacetime/contracts";

export type TimeResolution = "year" | "month";

export function yearMonthFromTick(tick: number): {
  year: number;
  month: number;
} {
  const year = Math.floor(tick / 12);
  return { year, month: tick - year * 12 + 1 };
}

export function temporalSortValue(observation: MapObservation): number {
  const temporal = observation.temporal;
  const year = temporal?.startYear ?? temporal?.endYear ?? 0;
  const month = temporal?.startMonth ?? temporal?.endMonth ?? 1;
  const day = temporal?.startDay ?? temporal?.endDay ?? 1;
  return year * 372 + (month - 1) * 31 + day - 1;
}

export function buildTemporalQuery(input: {
  currentTick: number | undefined;
  resolution: TimeResolution;
  startYear: number | undefined;
  endYear: number | undefined;
}): TemporalValue | undefined {
  if (input.currentTick !== undefined) {
    if (input.resolution === "month") {
      const { year, month } = yearMonthFromTick(input.currentTick);
      return {
        original: `${year}年${month}月`,
        startYear: year,
        startMonth: month,
        endYear: year,
        endMonth: month,
        certainty: "exact",
      };
    }
    return {
      original: String(input.currentTick),
      startYear: input.currentTick,
      endYear: input.currentTick,
      certainty: "exact",
    };
  }
  if (input.startYear === undefined && input.endYear === undefined)
    return undefined;
  return {
    original: [input.startYear, input.endYear]
      .filter((year) => year !== undefined)
      .join("—"),
    certainty: input.startYear === input.endYear ? "exact" : "range",
    ...(input.startYear !== undefined ? { startYear: input.startYear } : {}),
    ...(input.endYear !== undefined ? { endYear: input.endYear } : {}),
  };
}
