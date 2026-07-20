import type {
  PassageAlignmentBatch,
  PassageAlignmentDecision,
} from "@infinite-spacetime/contracts";

export function isPassageAlignmentBatch(
  value: unknown,
): value is PassageAlignmentBatch {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PassageAlignmentBatch>;
  const validPassages = (passages: unknown) =>
    Array.isArray(passages) &&
    passages.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.volumeLabel === "string" &&
        typeof item.textOriginal === "string",
    );
  return (
    record.version === 1 &&
    typeof record.publicationId === "string" &&
    typeof record.baseContentChecksum === "string" &&
    typeof record.workId === "string" &&
    typeof record.leftEditionId === "string" &&
    typeof record.rightEditionId === "string" &&
    validPassages(record.leftPassages) &&
    validPassages(record.rightPassages) &&
    Array.isArray(record.items) &&
    record.items.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        Array.isArray(item.leftPassageIds) &&
        Array.isArray(item.rightPassageIds) &&
        Array.isArray(item.reasons),
    ) &&
    new Set(record.items.map((item) => item.id)).size === record.items.length
  );
}

export function passageAlignmentStorageKey(
  value: PassageAlignmentBatch,
): string {
  return `infinite-spacetime-passage-alignment:${value.publicationId}:${value.baseContentChecksum}:${value.leftEditionId}:${value.rightEditionId}`;
}

export function decisionsBelongToBatch(
  batch: PassageAlignmentBatch,
  decisions: readonly PassageAlignmentDecision[],
): boolean {
  const ids = new Set(batch.items.map((item) => item.id));
  return (
    new Set(decisions.map((item) => item.suggestionId)).size ===
      decisions.length && decisions.every((item) => ids.has(item.suggestionId))
  );
}
