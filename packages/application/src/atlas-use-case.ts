import type {
  AtlasQuery,
  AtlasResult,
  HistoricalGeometry,
} from "@infinite-spacetime/contracts";
import { intersectsBounds, overlaps } from "@infinite-spacetime/domain";
import type { PublicationIndex } from "./publication-index";
import { historicalNameAt, paginate } from "./query-utils";

export function exploreAtlas(
  index: PublicationIndex,
  query: AtlasQuery,
): AtlasResult {
  const entityTypes = query.entityTypes
    ? new Set(query.entityTypes)
    : undefined;
  const inBounds = (geometry: HistoricalGeometry) =>
    overlaps(geometry.validDuring, query.temporal) &&
    intersectsBounds(geometry, query);
  const placeObservations = index.publication.geometries.flatMap((geometry) => {
    if (!inBounds(geometry)) return [];
    const place = index.places.get(geometry.placeId);
    const entity = place ? index.entities.get(place.entityId) : undefined;
    if (!place || !entity || (entityTypes && !entityTypes.has(entity.type)))
      return [];
    if (query.entityIds && !query.entityIds.includes(entity.id)) return [];
    return [
      {
        entityId: entity.id,
        placeId: place.id,
        geometryId: geometry.id,
        geometry: geometry.geometry,
        label: historicalNameAt(place, query.temporal, entity.preferredName),
        category: entity.type,
        ...(geometry.validDuring ? { temporal: geometry.validDuring } : {}),
      },
    ];
  });
  const occurrenceObservations = index.publication.occurrences.flatMap(
    (occurrence) => {
      if (!overlaps(occurrence.temporal, query.temporal)) return [];
      const entity = index.entities.get(occurrence.entityId);
      if (!entity || (entityTypes && !entityTypes.has(entity.type))) return [];
      if (query.entityIds && !query.entityIds.includes(entity.id)) return [];
      return (index.geometriesByPlace.get(occurrence.placeId) ?? []).flatMap(
        (geometry) => {
          if (!inBounds(geometry)) return [];
          return [
            {
              entityId: entity.id,
              placeId: occurrence.placeId,
              geometryId: geometry.id,
              occurrenceId: occurrence.id,
              geometry: geometry.geometry,
              label: occurrence.label ?? entity.preferredName,
              category: entity.type,
              ...(occurrence.temporal
                ? { temporal: occurrence.temporal }
                : geometry.validDuring
                  ? { temporal: geometry.validDuring }
                  : {}),
            },
          ];
        },
      );
    },
  );
  const page = paginate(
    [...placeObservations, ...occurrenceObservations],
    query,
  );
  return page.nextCursor
    ? { observations: page.items, nextCursor: page.nextCursor }
    : { observations: page.items };
}
