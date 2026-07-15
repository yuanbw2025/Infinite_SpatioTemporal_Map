import type { ReviewStatus, TemporalValue } from "./common";
import type { EntityId, GeometryId, PlaceIdentityId } from "./ids";

export interface GeoPoint {
  readonly type: "Point";
  readonly coordinates: readonly [longitude: number, latitude: number];
}

export interface GeoPolygon {
  readonly type: "Polygon";
  readonly coordinates: readonly (readonly (readonly [number, number])[])[];
}

export interface HistoricalGeometry {
  readonly id: GeometryId;
  readonly placeId: PlaceIdentityId;
  readonly geometry: GeoPoint | GeoPolygon;
  readonly validDuring?: TemporalValue;
  readonly precision: "site" | "settlement" | "region" | "unknown";
  readonly reviewStatus: ReviewStatus;
}

export interface HistoricalPlaceName {
  readonly name: string;
  readonly validDuring?: TemporalValue;
  readonly kind?: string;
}

export interface PlaceIdentity {
  readonly id: PlaceIdentityId;
  readonly entityId: EntityId;
  readonly preferredName: string;
  readonly historicalNames: readonly HistoricalPlaceName[];
  readonly parentPlaceIds: readonly PlaceIdentityId[];
}

export interface MapObservation {
  readonly entityId: EntityId;
  readonly placeId: PlaceIdentityId;
  readonly geometryId: GeometryId;
  readonly temporal?: TemporalValue;
  readonly label: string;
  readonly category: string;
}
