import type {
  DataContext,
  ResearchFinding,
  ResearchFindingKind,
  ResearchQuery,
  ResearchReport,
} from "@infinite-spacetime/contracts";
import type { ResearchRulePort } from "@infinite-spacetime/ports";
import type { PublicationIndex } from "./publication-index";
import { boundedLimit } from "./query-utils";
import { BUILT_IN_RESEARCH_RULES } from "./research-rules";

const FINDING_KINDS: readonly ResearchFindingKind[] = [
  "contradictory_assertions",
  "disputed_record",
  "unresolved_geometry",
  "chronology_conflict",
];

function validateFinding(
  index: PublicationIndex,
  finding: ResearchFinding,
): void {
  if (
    !finding.id.trim() ||
    !finding.ruleId.trim() ||
    !finding.title.trim() ||
    !finding.description.trim()
  )
    throw new Error("Research rule returned an incomplete finding");
  if (!FINDING_KINDS.includes(finding.kind))
    throw new Error(`Research rule returned unknown kind: ${finding.kind}`);
  for (const id of finding.entityIds)
    if (!index.entities.has(id))
      throw new Error(`Research finding references missing entity: ${id}`);
  const assertionIds = new Set(
    index.publication.assertions.map((assertion) => assertion.id),
  );
  for (const id of finding.assertionIds)
    if (!assertionIds.has(id))
      throw new Error(`Research finding references missing assertion: ${id}`);
  for (const id of finding.passageIds)
    if (!index.passages.has(id))
      throw new Error(`Research finding references missing passage: ${id}`);
}

export async function inspectResearch(
  index: PublicationIndex,
  dataContext: DataContext,
  query: ResearchQuery = {},
  externalRules: readonly ResearchRulePort[] = [],
): Promise<ResearchReport> {
  const limit = boundedLimit(query.limit, 200, 1_000);
  const acceptedKinds = query.kinds ? new Set(query.kinds) : undefined;
  const findings = BUILT_IN_RESEARCH_RULES.flatMap((rule) =>
    rule.inspect(index, query),
  );
  for (const rule of externalRules) {
    if (!rule.id.trim()) throw new Error("Research rule port requires an id");
    const returned = await rule.inspect({
      dataContext,
      publication: index.publication,
      query,
    });
    for (const finding of returned) {
      if (finding.ruleId !== rule.id)
        throw new Error(
          `Research rule ${rule.id} returned mismatched ruleId ${finding.ruleId}`,
        );
      findings.push(finding);
    }
  }
  const ids = new Set<string>();
  for (const finding of findings) {
    validateFinding(index, finding);
    if (ids.has(finding.id))
      throw new Error(`Duplicate research finding id: ${finding.id}`);
    ids.add(finding.id);
  }
  const filtered = acceptedKinds
    ? findings.filter((finding) => acceptedKinds.has(finding.kind))
    : findings;
  const counts: Record<ResearchFindingKind, number> = {
    contradictory_assertions: 0,
    disputed_record: 0,
    unresolved_geometry: 0,
    chronology_conflict: 0,
  };
  for (const finding of filtered) counts[finding.kind] += 1;
  return {
    findings: filtered.slice(0, limit),
    counts,
    truncated: filtered.length > limit,
  };
}
