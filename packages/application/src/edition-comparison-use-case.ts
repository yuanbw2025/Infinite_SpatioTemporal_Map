import type {
  EditionComparisonQuery,
  EditionComparisonResult,
  EditionComparisonRow,
  Passage,
  TextComparison,
  TextDiffSegment,
} from "@infinite-spacetime/contracts";
import { NotFoundError } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";

const MAX_EXACT_DIFF_CELLS = 250_000;

interface DiffOperation {
  readonly kind: TextDiffSegment["kind"];
  readonly text: string;
}

function append(
  operations: DiffOperation[],
  kind: DiffOperation["kind"],
  value: string,
): void {
  if (!value) return;
  const previous = operations.at(-1);
  if (previous?.kind === kind) {
    operations[operations.length - 1] = {
      kind,
      text: previous.text + value,
    };
  } else {
    operations.push({ kind, text: value });
  }
}

function middleDiff(
  left: readonly string[],
  right: readonly string[],
): DiffOperation[] {
  const rows = Array.from(
    { length: left.length + 1 },
    () => new Uint32Array(right.length + 1),
  );
  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      rows[leftIndex]![rightIndex] =
        left[leftIndex] === right[rightIndex]
          ? rows[leftIndex + 1]![rightIndex + 1]! + 1
          : Math.max(
              rows[leftIndex + 1]![rightIndex]!,
              rows[leftIndex]![rightIndex + 1]!,
            );
    }
  }

  const operations: DiffOperation[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      append(operations, "equal", left[leftIndex]!);
      leftIndex += 1;
      rightIndex += 1;
    } else if (
      rows[leftIndex + 1]![rightIndex]! >= rows[leftIndex]![rightIndex + 1]!
    ) {
      append(operations, "removed", left[leftIndex]!);
      leftIndex += 1;
    } else {
      append(operations, "inserted", right[rightIndex]!);
      rightIndex += 1;
    }
  }
  append(operations, "removed", left.slice(leftIndex).join(""));
  append(operations, "inserted", right.slice(rightIndex).join(""));
  return operations;
}

/** Character-safe comparison with a bounded exact-diff cost for long passages. */
export function compareText(
  leftText: string,
  rightText: string,
): TextComparison {
  const left = Array.from(leftText);
  const right = Array.from(rightText);
  let prefixLength = 0;
  while (
    prefixLength < left.length &&
    prefixLength < right.length &&
    left[prefixLength] === right[prefixLength]
  ) {
    prefixLength += 1;
  }
  let suffixLength = 0;
  while (
    suffixLength < left.length - prefixLength &&
    suffixLength < right.length - prefixLength &&
    left[left.length - 1 - suffixLength] ===
      right[right.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const leftMiddle = left.slice(prefixLength, left.length - suffixLength);
  const rightMiddle = right.slice(prefixLength, right.length - suffixLength);
  const isCoarse =
    leftMiddle.length * rightMiddle.length > MAX_EXACT_DIFF_CELLS;
  const operations: DiffOperation[] = [];
  append(operations, "equal", left.slice(0, prefixLength).join(""));
  if (isCoarse) {
    append(operations, "removed", leftMiddle.join(""));
    append(operations, "inserted", rightMiddle.join(""));
  } else {
    for (const operation of middleDiff(leftMiddle, rightMiddle))
      append(operations, operation.kind, operation.text);
  }
  append(
    operations,
    "equal",
    suffixLength ? left.slice(left.length - suffixLength).join("") : "",
  );

  const equalLength = operations
    .filter((operation) => operation.kind === "equal")
    .reduce((total, operation) => total + Array.from(operation.text).length, 0);
  const longestLength = Math.max(left.length, right.length);
  return {
    left: operations.filter((operation) => operation.kind !== "inserted"),
    right: operations.filter((operation) => operation.kind !== "removed"),
    similarity: longestLength ? equalLength / longestLength : 1,
    isCoarse,
  };
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function labelFor(index: PublicationIndex, passage: Passage): string {
  return (
    passage.sectionLabel ??
    index.volumes.get(passage.volumeId)?.label ??
    "未命名卷章"
  );
}

function alignmentKey(index: PublicationIndex, passage: Passage): string {
  const volumeLabel = index.volumes.get(passage.volumeId)?.label ?? "";
  return `${normalized(volumeLabel)}\0${normalized(labelFor(index, passage))}`;
}

function sortedPassages(
  index: PublicationIndex,
  editionId: EditionComparisonQuery["leftEditionId"],
): Passage[] {
  return [...(index.passagesByEdition.get(editionId) ?? [])].toSorted(
    (left, right) => {
      const leftVolume = index.volumes.get(left.volumeId);
      const rightVolume = index.volumes.get(right.volumeId);
      return (
        (leftVolume?.sequence ?? 0) - (rightVolume?.sequence ?? 0) ||
        left.sequence - right.sequence ||
        left.id.localeCompare(right.id)
      );
    },
  );
}

function comparisonRow(
  index: PublicationIndex,
  left: Passage | undefined,
  right: Passage | undefined,
  alignment: EditionComparisonRow["alignment"],
): EditionComparisonRow {
  return {
    key: left ? `left-${left.id}` : `right-${right!.id}`,
    label: labelFor(index, left ?? right!),
    alignment,
    ...(left ? { left } : {}),
    ...(right ? { right } : {}),
    ...(left && right
      ? { difference: compareText(left.text.original, right.text.original) }
      : {}),
  };
}

export function compareEditions(
  index: PublicationIndex,
  query: EditionComparisonQuery,
): EditionComparisonResult {
  const leftEdition = index.editions.get(query.leftEditionId);
  const rightEdition = index.editions.get(query.rightEditionId);
  if (!leftEdition) throw new NotFoundError("Edition", query.leftEditionId);
  if (!rightEdition) throw new NotFoundError("Edition", query.rightEditionId);
  if (
    query.leftEditionId === query.rightEditionId ||
    leftEdition.workId !== query.workId ||
    rightEdition.workId !== query.workId
  ) {
    throw new Error(
      "Edition comparison requires two editions of the same work",
    );
  }

  const leftPassages = sortedPassages(index, query.leftEditionId);
  const rightPassages = sortedPassages(index, query.rightEditionId);
  const consumed = new Set<string>();
  const rows: EditionComparisonRow[] = [];
  for (const left of leftPassages) {
    const key = alignmentKey(index, left);
    const sameLabel = rightPassages.find(
      (right) => !consumed.has(right.id) && alignmentKey(index, right) === key,
    );
    const leftVolumeLabel = normalized(
      index.volumes.get(left.volumeId)?.label ?? "",
    );
    const sameSequence = rightPassages.find(
      (right) =>
        !consumed.has(right.id) &&
        right.sequence === left.sequence &&
        normalized(index.volumes.get(right.volumeId)?.label ?? "") ===
          leftVolumeLabel,
    );
    const right = sameLabel ?? sameSequence;
    if (right) consumed.add(right.id);
    rows.push(
      comparisonRow(
        index,
        left,
        right,
        sameLabel ? "label" : right ? "sequence" : "unpaired",
      ),
    );
  }
  for (const right of rightPassages) {
    if (!consumed.has(right.id))
      rows.push(comparisonRow(index, undefined, right, "unpaired"));
  }
  return { leftEdition, rightEdition, rows };
}
