import type {
  Page,
  Passage,
  PassageContext,
  PassageId,
  PassageQuery,
} from "@infinite-spacetime/contracts";
import { NotFoundError } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";
import { paginate } from "./query-utils";

export function listPassages(
  index: PublicationIndex,
  query: PassageQuery,
): Page<Passage> {
  return paginate(
    [...(index.passagesByWork.get(query.workId) ?? [])]
      .filter(
        (item) =>
          query.editionId === undefined ||
          index.editionIdForPassage(item) === query.editionId,
      )
      .filter(
        (item) =>
          query.volumeId === undefined || item.volumeId === query.volumeId,
      )
      .toSorted((left, right) => left.sequence - right.sequence),
    query,
  );
}

export function readPassage(
  index: PublicationIndex,
  id: PassageId,
): PassageContext {
  const passage = index.passages.get(id);
  if (!passage) throw new NotFoundError("Passage", id);
  const volume = index.volumes.get(passage.volumeId);
  const edition = volume ? index.editions.get(volume.editionId) : undefined;
  const work = edition ? index.works.get(edition.workId) : undefined;
  if (!volume || !edition || !work)
    throw new NotFoundError("Passage context", id);
  const siblings = [
    ...(index.passagesByEdition.get(edition.id) ?? []),
  ].toSorted((left, right) => left.sequence - right.sequence);
  const position = siblings.findIndex((item) => item.id === id);
  const mentions = index.mentionsByPassage.get(id) ?? [];
  const previousPassageId =
    position > 0 ? siblings[position - 1]?.id : undefined;
  const nextPassageId =
    position >= 0 && position < siblings.length - 1
      ? siblings[position + 1]?.id
      : undefined;
  return {
    passage,
    work,
    edition,
    volume,
    facsimiles: passage.facsimileAnchors.flatMap((anchor) => {
      const page = index.pages.get(anchor.pageId);
      return page ? [{ anchor, page }] : [];
    }),
    mentions,
    mentionedEntities: mentions.flatMap((mention) => {
      const entity = index.entities.get(mention.entityId);
      return entity ? [entity] : [];
    }),
    evidencedAssertions: index.assertionsByPassage.get(id) ?? [],
    ...(previousPassageId ? { previousPassageId } : {}),
    ...(nextPassageId ? { nextPassageId } : {}),
  };
}
