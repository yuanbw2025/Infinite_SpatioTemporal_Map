import type {
  DatasetOverview,
  ReviewStatus,
} from "@infinite-spacetime/contracts";
import type { PublicationIndex } from "./publication-index";

export function getDatasetOverview(index: PublicationIndex): DatasetOverview {
  const reviewCounts: Record<ReviewStatus, number> = {
    raw: 0,
    machine_suggested: 0,
    reviewed: 0,
    verified: 0,
    disputed: 0,
    rejected: 0,
  };
  for (const status of [
    ...index.publication.entities.map((item) => item.reviewStatus),
    ...index.publication.mentions.map((item) => item.reviewStatus),
    ...index.publication.assertions.map((item) => item.reviewStatus),
    ...index.publication.geometries.map((item) => item.reviewStatus),
    ...index.publication.occurrences.map((item) => item.reviewStatus),
  ])
    reviewCounts[status] += 1;
  const publication = index.publication;
  return {
    manifest: publication.manifest,
    counts: {
      works: publication.works.length,
      editions: publication.editions.length,
      volumes: publication.volumes.length,
      passages: publication.passages.length,
      entities: publication.entities.length,
      mentions: publication.mentions.length,
      assertions: publication.assertions.length,
      places: publication.places.length,
      geometries: publication.geometries.length,
      occurrences: publication.occurrences.length,
    },
    quality: {
      reviewCounts,
      coverage: {
        facsimilePassages: publication.passages.filter(
          (item) => item.facsimileAnchors.length > 0,
        ).length,
        simplifiedPassages: publication.passages.filter(
          (item) => item.text.simplified,
        ).length,
        translatedPassages: publication.passages.filter(
          (item) => item.text.modernTranslation,
        ).length,
        evidencedAssertions: publication.assertions.filter(
          (item) => item.evidence.length,
        ).length,
        datedAssertions: publication.assertions.filter((item) => item.temporal)
          .length,
        locatedPlaces: new Set(
          publication.geometries.map((item) => item.placeId),
        ).size,
        datedOccurrences: publication.occurrences.filter(
          (item) => item.temporal,
        ).length,
      },
    },
  };
}
