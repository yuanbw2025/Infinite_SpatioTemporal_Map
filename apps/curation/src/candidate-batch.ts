import type { CandidateBatch } from "@infinite-spacetime/contracts";

export function isCandidateBatch(value: unknown): value is CandidateBatch {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CandidateBatch>;
  return (
    record.version === 1 &&
    typeof record.publicationId === "string" &&
    typeof record.baseContentChecksum === "string" &&
    typeof record.generatorId === "string" &&
    Array.isArray(record.candidates) &&
    record.candidates.every(
      (candidate) =>
        candidate &&
        typeof candidate.id === "string" &&
        typeof candidate.kind === "string" &&
        candidate.payload &&
        typeof candidate.payload === "object" &&
        Array.isArray(candidate.evidence),
    )
  );
}

export function candidateStorageKey(value: CandidateBatch): string {
  return [
    "infinite-spacetime-curation",
    value.publicationId,
    value.baseContentChecksum,
    value.generatorId,
    value.generatedAt,
  ].join(":");
}
