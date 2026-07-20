import type {
  DecisionBundle,
  DecisionMergeReport,
} from "@infinite-spacetime/contracts";

type MutableDecision = Record<string, unknown> & {
  readonly reviewer: string;
  readonly decidedAt: string;
};

export interface DecisionBundleScope {
  readonly workspace: DecisionBundle["workspace"];
  readonly publicationId: string;
  readonly baseContentChecksum: string;
  readonly batchKey: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function decisionId(
  workspace: DecisionBundle["workspace"],
  decision: Record<string, unknown>,
): string | undefined {
  const key =
    workspace === "candidate_review"
      ? "candidateId"
      : workspace === "entity_alignment"
        ? "alignmentId"
        : "suggestionId";
  const value = decision[key];
  return typeof value === "string" && value ? value : undefined;
}

function canonical(value: unknown, omitDecisionAudit = false): string {
  if (Array.isArray(value))
    return `[${value.map((item) => canonical(item)).join(",")}]`;
  const object = record(value);
  if (object)
    return `{${Object.keys(object)
      .filter(
        (key) =>
          !omitDecisionAudit || (key !== "reviewer" && key !== "decidedAt"),
      )
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function isDecisionBundle(value: unknown): value is DecisionBundle {
  const bundle = record(value);
  return Boolean(
    bundle &&
    bundle.version === 1 &&
    ["candidate_review", "entity_alignment", "passage_alignment"].includes(
      String(bundle.workspace),
    ) &&
    nonEmptyText(bundle.bundleId) &&
    nonEmptyText(bundle.publicationId) &&
    nonEmptyText(bundle.baseContentChecksum) &&
    nonEmptyText(bundle.batchKey) &&
    nonEmptyText(bundle.createdAt) &&
    nonEmptyText(bundle.createdBy) &&
    (bundle.sourceBundleIds === undefined ||
      (Array.isArray(bundle.sourceBundleIds) &&
        bundle.sourceBundleIds.every(nonEmptyText) &&
        new Set(bundle.sourceBundleIds).size ===
          bundle.sourceBundleIds.length)) &&
    Array.isArray(bundle.decisions) &&
    bundle.decisions.every((item) => {
      const decision = record(item);
      return Boolean(
        decision &&
        decisionId(bundle.workspace as DecisionBundle["workspace"], decision) &&
        nonEmptyText(decision.reviewer) &&
        nonEmptyText(decision.decidedAt),
      );
    }),
  );
}

export function decisionBundleMatchesScope(
  bundle: DecisionBundle,
  scope: DecisionBundleScope,
): boolean {
  return (
    bundle.workspace === scope.workspace &&
    bundle.publicationId === scope.publicationId &&
    bundle.baseContentChecksum === scope.baseContentChecksum &&
    bundle.batchKey === scope.batchKey
  );
}

export function mergeDecisionBundles<T extends DecisionBundle>(
  bundles: readonly T[],
): {
  readonly bundle?: T;
  readonly report: DecisionMergeReport;
} {
  if (!bundles.length) throw new Error("至少需要一个决策协作包。");
  const orderedBundles = bundles.toSorted((left, right) =>
    compareText(left.bundleId, right.bundleId),
  );
  const first = orderedBundles[0]!;
  const scope = [
    first.workspace,
    first.publicationId,
    first.baseContentChecksum,
    first.batchKey,
  ].join("\u0000");
  if (
    orderedBundles.some(
      (bundle) =>
        [
          bundle.workspace,
          bundle.publicationId,
          bundle.baseContentChecksum,
          bundle.batchKey,
        ].join("\u0000") !== scope,
    )
  )
    throw new Error("决策协作包不属于同一发布版本、工作区或批次。");
  const sourceBundleIds = orderedBundles.map((bundle) => bundle.bundleId);
  const provenanceBundleIds = [
    ...new Set(
      orderedBundles.flatMap((bundle) => [
        bundle.bundleId,
        ...(bundle.sourceBundleIds ?? []),
      ]),
    ),
  ].toSorted();
  if (new Set(sourceBundleIds).size !== sourceBundleIds.length)
    throw new Error("决策协作包包含重复 bundleId。");

  const groups = new Map<
    string,
    { bundleId: string; decision: MutableDecision }[]
  >();
  for (const bundle of orderedBundles) {
    const ownIds = new Set<string>();
    for (const value of bundle.decisions) {
      const decision = value as unknown as MutableDecision;
      const id = decisionId(bundle.workspace, decision);
      if (!id) throw new Error("决策缺少稳定目标 ID。");
      if (ownIds.has(id))
        throw new Error(`决策包 ${bundle.bundleId} 内重复目标 ${id}。`);
      ownIds.add(id);
      groups.set(id, [
        ...(groups.get(id) ?? []),
        { bundleId: bundle.bundleId, decision },
      ]);
    }
  }

  const merged: MutableDecision[] = [];
  const conflicts: DecisionMergeReport["conflicts"][number][] = [];
  let equivalentDecisionCount = 0;
  for (const [id, variants] of [...groups].toSorted(([left], [right]) =>
    compareText(left, right),
  )) {
    const outcomes = new Set(
      variants.map(({ decision }) => canonical(decision, true)),
    );
    if (outcomes.size > 1) {
      conflicts.push({
        decisionId: id,
        variants: variants.map(({ bundleId, decision }) => ({
          sourceBundleId: bundleId,
          reviewer: decision.reviewer,
          decidedAt: decision.decidedAt,
          decision,
        })),
      });
      continue;
    }
    equivalentDecisionCount += variants.length - 1;
    merged.push(
      variants.toSorted(
        (left, right) =>
          compareText(left.decision.decidedAt, right.decision.decidedAt) ||
          compareText(left.decision.reviewer, right.decision.reviewer) ||
          compareText(left.bundleId, right.bundleId),
      )[0]!.decision,
    );
  }
  const report: DecisionMergeReport = {
    sourceBundleIds,
    mergedDecisionCount: merged.length,
    equivalentDecisionCount,
    conflicts,
  };
  if (conflicts.length) return { report };
  return {
    bundle: {
      version: 1,
      bundleId: `merged:${sourceBundleIds.join("+")}`,
      workspace: first.workspace,
      publicationId: first.publicationId,
      baseContentChecksum: first.baseContentChecksum,
      batchKey: first.batchKey,
      createdAt: orderedBundles
        .map((bundle) => bundle.createdAt)
        .toSorted()
        .at(-1)!,
      createdBy: "decision-bundle-merge",
      sourceBundleIds: provenanceBundleIds,
      decisions: merged,
    } as unknown as T,
    report,
  };
}
