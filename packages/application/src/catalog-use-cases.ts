import type {
  EditionId,
  Page,
  SourceId,
  Work,
  WorkDetails,
  WorkId,
  WorkQuery,
  Volume,
} from "@infinite-spacetime/contracts";
import { overlaps } from "@infinite-spacetime/domain";
import { NotFoundError } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";
import { paginate } from "./query-utils";

export function listWorks(
  index: PublicationIndex,
  query: WorkQuery = {},
): Page<Work> {
  const term = query.text?.trim().toLocaleLowerCase();
  const region = query.region?.trim().toLocaleLowerCase();
  const categories = query.categories ? new Set(query.categories) : undefined;
  const items = index.publication.works
    .filter((work) => !categories || categories.has(work.category))
    .filter(
      (work) =>
        !term ||
        `${work.title} ${work.alternativeTitles.join(" ")} ${work.abstract ?? ""}`
          .toLocaleLowerCase()
          .includes(term),
    )
    .filter(
      (work) =>
        !region ||
        (work.coverage?.regionLabels.join(" ") ?? "")
          .toLocaleLowerCase()
          .includes(region),
    )
    .filter((work) => overlaps(work.coverage?.temporal, query.temporal));
  return paginate(items, query);
}

export function openWork(index: PublicationIndex, id: WorkId): WorkDetails {
  const work = index.works.get(id);
  if (!work) throw new NotFoundError("Work", id);
  const editions = index.editionsByWork.get(id) ?? [];
  const sourceIds = [
    ...new Set<SourceId>([
      ...work.sourceRefs.map((reference) => reference.sourceId),
      ...editions.flatMap((edition) =>
        edition.sourceRefs.map((reference) => reference.sourceId),
      ),
    ]),
  ];
  return {
    work,
    editions,
    sources: sourceIds.flatMap((sourceId) => {
      const source = index.sources.get(sourceId);
      return source ? [source] : [];
    }),
  };
}

export function listVolumes(
  index: PublicationIndex,
  editionId: EditionId,
): readonly Volume[] {
  return index.volumesByEdition.get(editionId) ?? [];
}
