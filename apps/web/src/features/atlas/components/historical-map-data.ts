import type { MapObservation } from "@infinite-spacetime/contracts";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";

export interface MapProperties {
  observationKey: string;
  label: string;
  category: string;
  temporal: string;
}

export function observationKey(observation: MapObservation): string {
  return `${observation.geometryId}:${observation.occurrenceId ?? observation.entityId}`;
}

export function mutableGeometry(
  observation: MapObservation,
): Point | Polygon | MultiPolygon {
  if (observation.geometry.type === "Point") {
    const [longitude, latitude] = observation.geometry.coordinates;
    return { type: "Point", coordinates: [longitude, latitude] };
  }
  if (observation.geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: observation.geometry.coordinates.map((polygon) =>
        polygon.map((ring) =>
          ring.map(([longitude, latitude]) => [longitude, latitude]),
        ),
      ),
    };
  }
  return {
    type: "Polygon",
    coordinates: observation.geometry.coordinates.map((ring) =>
      ring.map(([longitude, latitude]) => [longitude, latitude]),
    ),
  };
}

function featureFor(
  observation: MapObservation,
): Feature<Point | Polygon | MultiPolygon, MapProperties> {
  const key = observationKey(observation);
  return {
    type: "Feature",
    id: key,
    properties: {
      observationKey: key,
      label: observation.label,
      category: observation.category,
      temporal: observation.temporal?.original ?? "",
    },
    geometry: mutableGeometry(observation),
  };
}

export function observationCollections(
  observations: readonly MapObservation[],
): {
  points: FeatureCollection<Point, MapProperties>;
  regions: FeatureCollection<Polygon | MultiPolygon, MapProperties>;
} {
  const features = observations.map(featureFor);
  return {
    points: {
      type: "FeatureCollection",
      features: features.filter(
        (feature): feature is Feature<Point, MapProperties> =>
          feature.geometry.type === "Point",
      ),
    },
    regions: {
      type: "FeatureCollection",
      features: features.filter(
        (feature): feature is Feature<Polygon | MultiPolygon, MapProperties> =>
          feature.geometry.type === "Polygon" ||
          feature.geometry.type === "MultiPolygon",
      ),
    },
  };
}

export function routeCollection(
  journey: readonly MapObservation[],
): FeatureCollection<LineString> {
  const coordinates = journey.flatMap((observation) =>
    observation.geometry.type === "Point"
      ? [[...observation.geometry.coordinates] as [number, number]]
      : [],
  );
  return {
    type: "FeatureCollection",
    features:
      coordinates.length > 1
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates },
            },
          ]
        : [],
  };
}

export function selectionCollection(
  selected: MapObservation | undefined,
): FeatureCollection<Geometry> {
  return {
    type: "FeatureCollection",
    features: selected
      ? [
          {
            type: "Feature",
            properties: {},
            geometry: mutableGeometry(selected),
          },
        ]
      : [],
  };
}
