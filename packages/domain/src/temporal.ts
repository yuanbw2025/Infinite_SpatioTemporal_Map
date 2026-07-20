import type { TemporalValue } from "@infinite-spacetime/contracts";

export function temporalOrdinal(
  value: TemporalValue | undefined,
  boundary: "start" | "end",
): number | undefined {
  if (!value) return undefined;
  const year =
    boundary === "start"
      ? (value.startYear ?? value.endYear)
      : (value.endYear ?? value.startYear);
  if (year === undefined) return undefined;
  const month =
    boundary === "start" ? (value.startMonth ?? 1) : (value.endMonth ?? 12);
  const day =
    boundary === "start" ? (value.startDay ?? 1) : (value.endDay ?? 31);
  return year * 372 + (month - 1) * 31 + (day - 1);
}

export function overlaps(
  candidate: TemporalValue | undefined,
  requested: TemporalValue | undefined,
): boolean {
  if (!requested || !candidate) return true;
  const candidateStart = temporalOrdinal(candidate, "start");
  const candidateEnd = temporalOrdinal(candidate, "end");
  const requestedStart = temporalOrdinal(requested, "start");
  const requestedEnd = temporalOrdinal(requested, "end");
  if (
    [candidateStart, candidateEnd, requestedStart, requestedEnd].some(
      (item) => item === undefined,
    )
  )
    return true;
  return candidateEnd! >= requestedStart! && candidateStart! <= requestedEnd!;
}

export function overlapsYears(
  candidate:
    { readonly startYear?: number; readonly endYear?: number } | undefined,
  startYear: number | undefined,
  endYear: number | undefined,
): boolean {
  if (startYear === undefined && endYear === undefined) return true;
  if (!candidate) return false;
  const candidateStart = candidate.startYear ?? candidate.endYear;
  const candidateEnd = candidate.endYear ?? candidate.startYear;
  if (candidateStart === undefined || candidateEnd === undefined) return false;
  return !(
    (startYear !== undefined && candidateEnd < startYear) ||
    (endYear !== undefined && candidateStart > endYear)
  );
}
