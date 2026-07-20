import type {
  MapObservation,
  TemporalValue,
} from "@infinite-spacetime/contracts";

export type TimeResolution = "year" | "month" | "day";

function floorDivide(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

/** Proleptic Gregorian civil date to a stable integer day, including BCE years. */
export function dayFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = floorDivide(adjustedYear, 400);
  const yearOfEra = adjustedYear - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = floorDivide(153 * shiftedMonth + 2, 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    floorDivide(yearOfEra, 4) -
    floorDivide(yearOfEra, 100) +
    dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

export function civilFromDay(value: number): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = value + 719_468;
  const era = floorDivide(shifted, 146_097);
  const dayOfEra = shifted - era * 146_097;
  const yearOfEra = floorDivide(
    dayOfEra -
      floorDivide(dayOfEra, 1_460) +
      floorDivide(dayOfEra, 36_524) -
      floorDivide(dayOfEra, 146_096),
    365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + floorDivide(yearOfEra, 4) - floorDivide(yearOfEra, 100));
  const monthPrime = floorDivide(5 * dayOfYear + 2, 153);
  const day = dayOfYear - floorDivide(153 * monthPrime + 2, 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return { year, month, day };
}

export function rangeTick(
  year: number,
  resolution: TimeResolution,
  boundary: "start" | "end",
): number {
  if (resolution === "year") return year;
  if (resolution === "month") return year * 12 + (boundary === "end" ? 11 : 0);
  return dayFromCivil(
    year,
    boundary === "end" ? 12 : 1,
    boundary === "end" ? 31 : 1,
  );
}

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
    if (input.resolution === "day") {
      const { year, month, day } = civilFromDay(input.currentTick);
      return {
        original: `${year}年${month}月${day}日`,
        startYear: year,
        startMonth: month,
        startDay: day,
        endYear: year,
        endMonth: month,
        endDay: day,
        certainty: "exact",
        calendar: "proleptic_gregorian",
      };
    }
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
