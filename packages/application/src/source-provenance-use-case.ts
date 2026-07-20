import type {
  Edition,
  SourceId,
  SourceProvenance,
  SourceProvenanceQuery,
  SourceRelation,
  Work,
} from "@infinite-spacetime/contracts";
import { NotFoundError } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";

export function openSourceProvenance(
  index: PublicationIndex,
  query: SourceProvenanceQuery,
): SourceProvenance {
  const center = index.sources.get(query.sourceId);
  if (!center) throw new NotFoundError("Source", query.sourceId);
  const depth = Math.max(0, Math.min(Math.floor(query.depth ?? 2), 4));
  const visited = new Set<SourceId>([query.sourceId]);
  let frontier: SourceId[] = [query.sourceId];
  for (let level = 0; level < depth && frontier.length; level += 1) {
    const next: SourceId[] = [];
    for (const sourceId of frontier) {
      for (const entry of index.sourceRelationsBySource.get(sourceId) ?? []) {
        const relation = entry.relation;
        const neighbour =
          relation.subjectSourceId === sourceId
            ? relation.objectSourceId
            : relation.subjectSourceId;
        if (visited.has(neighbour)) continue;
        visited.add(neighbour);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  const relations: SourceRelation[] = index.publication.sourceRelations.filter(
    (relation) =>
      visited.has(relation.subjectSourceId) &&
      visited.has(relation.objectSourceId),
  );
  const referencesSource = (
    sourceRefs: readonly { readonly sourceId: SourceId }[],
  ) => sourceRefs.some((reference) => visited.has(reference.sourceId));
  const works: Work[] = index.publication.works.filter((work) =>
    referencesSource(work.sourceRefs),
  );
  const editions: Edition[] = index.publication.editions.filter((edition) =>
    referencesSource(edition.sourceRefs),
  );
  return {
    center,
    sources: [...visited]
      .map((sourceId) => index.sources.get(sourceId))
      .filter((source): source is NonNullable<typeof source> =>
        Boolean(source),
      ),
    relations,
    works,
    editions,
  };
}
