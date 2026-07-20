import type {
  DataContext,
  Page,
  SearchHit,
  SearchMode,
  SearchQuery,
  SearchResult,
  SemanticSearchCandidate,
} from "@infinite-spacetime/contracts";
import type {
  SearchIndexPort,
  SemanticSearchPort,
} from "@infinite-spacetime/ports";
import type { PublicationIndex } from "./publication-index";
import { boundedLimit, paginate } from "./query-utils";
import { createSearchScope, search } from "./search-use-case";

function hitKey(hit: SearchHit): string {
  const id =
    hit.kind === "work"
      ? hit.work.id
      : hit.kind === "passage"
        ? hit.passage.id
        : hit.entity.id;
  return `${hit.kind}:${id}`;
}

function candidateKey(candidate: SemanticSearchCandidate): string {
  return `${candidate.kind}:${candidate.id}`;
}

function semanticHits(
  index: PublicationIndex,
  query: SearchQuery,
  candidates: readonly SemanticSearchCandidate[],
): SearchHit[] {
  const scope = createSearchScope(index, query);
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.score))
      throw new Error(
        `Semantic candidate has invalid score: ${candidateKey(candidate)}`,
      );
    const key = candidateKey(candidate);
    if (seen.has(key)) throw new Error(`Duplicate semantic candidate: ${key}`);
    seen.add(key);
    if (candidate.kind === "work") {
      const work = index.works.get(candidate.id);
      if (!work)
        throw new Error(
          `Semantic index references missing work: ${candidate.id}`,
        );
      if (scope.workAllowed(work))
        hits.push({ kind: "work", score: candidate.score, work });
      continue;
    }
    if (candidate.kind === "passage") {
      const passage = index.passages.get(candidate.id);
      if (!passage)
        throw new Error(
          `Semantic index references missing passage: ${candidate.id}`,
        );
      if (scope.passageAllowed(passage))
        hits.push({ kind: "passage", score: candidate.score, passage });
      continue;
    }
    const entity = index.entities.get(candidate.id);
    if (!entity)
      throw new Error(
        `Semantic index references missing entity: ${candidate.id}`,
      );
    if (scope.entityAllowed(entity))
      hits.push({ kind: "entity", score: candidate.score, entity });
  }
  return hits;
}

async function lexicalPage(
  index: PublicationIndex,
  query: SearchQuery,
  port?: SearchIndexPort,
): Promise<Page<SearchHit>> {
  return port ? port.search(query) : search(index, query);
}

function withoutPage(query: SearchQuery, limit: number): SearchQuery {
  const { cursor: _cursor, limit: _limit, ...filters } = query;
  return { ...filters, limit };
}

export async function executeSearch(
  index: PublicationIndex,
  dataContext: DataContext,
  query: SearchQuery,
  lexicalPort?: SearchIndexPort,
  semanticPort?: SemanticSearchPort,
): Promise<SearchResult> {
  const requestedMode: SearchMode = query.mode ?? "lexical";
  if (requestedMode === "lexical") {
    return {
      ...(await lexicalPage(index, query, lexicalPort)),
      requestedMode,
      executedMode: "lexical",
    };
  }
  if (!semanticPort) {
    return {
      ...(await lexicalPage(index, query, lexicalPort)),
      requestedMode,
      executedMode: "lexical",
      notice: "当前发布环境未配置语义索引，已明确回退到词面检索。",
    };
  }
  const collectionLimit = boundedLimit(query.limit, 200, 1_000);
  const candidates = await semanticPort.search({
    dataContext,
    query: withoutPage(query, collectionLimit),
    limit: collectionLimit,
  });
  const semantic = semanticHits(index, query, candidates);
  if (requestedMode === "semantic") {
    return {
      ...paginate(semantic, query),
      requestedMode,
      executedMode: "semantic",
    };
  }
  const lexical = await lexicalPage(
    index,
    withoutPage(query, collectionLimit),
    lexicalPort,
  );
  const merged = new Map<string, SearchHit>();
  for (const hit of lexical.items)
    merged.set(hitKey(hit), { ...hit, score: hit.score * 0.45 });
  for (const hit of semantic) {
    const key = hitKey(hit);
    const existing = merged.get(key);
    merged.set(key, {
      ...hit,
      score: hit.score * 0.55 + (existing?.score ?? 0),
    });
  }
  const ranked = [...merged.values()].toSorted(
    (left, right) =>
      right.score - left.score || hitKey(left).localeCompare(hitKey(right)),
  );
  return {
    ...paginate(ranked, query),
    requestedMode,
    executedMode: "hybrid",
  };
}
