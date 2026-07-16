import type { EvidenceSpan, ReviewStatus, TemporalValue } from "./common";
import type {
  EntityId,
  GeometryId,
  OccurrenceId,
  PlaceIdentityId,
} from "./ids";

export interface GeoPoint {
  readonly type: "Point";
  readonly coordinates: readonly [longitude: number, latitude: number];
}

export interface GeoPolygon {
  readonly type: "Polygon";
  readonly coordinates: readonly (readonly (readonly [number, number])[])[];
}

export interface GeoMultiPolygon {
  readonly type: "MultiPolygon";
  readonly coordinates: readonly (readonly (readonly (readonly [
    number,
    number,
  ])[])[])[];
}

export type HistoricalShape = GeoPoint | GeoPolygon | GeoMultiPolygon;

export interface HistoricalGeometry {
  readonly id: GeometryId;
  readonly placeId: PlaceIdentityId;
  readonly geometry: HistoricalShape;
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

export type OccurrenceKind =
  | "birth"
  | "death"
  | "native_place"
  | "residence"
  | "office"
  | "journey"
  | "event"
  | "creation"
  | "discovery"
  | "collection"
  | "other";

/** Connects any entity to a historical place and time with source evidence. */
export interface SpatiotemporalOccurrence {
  readonly id: OccurrenceId;
  readonly entityId: EntityId;
  readonly placeId: PlaceIdentityId;
  readonly kind: OccurrenceKind;
  readonly label?: string;
  readonly temporal?: TemporalValue;
  readonly sequence?: number;
  readonly evidence: readonly EvidenceSpan[];
  readonly reviewStatus: ReviewStatus;
}

export interface MapObservation {
  readonly entityId: EntityId;
  readonly placeId: PlaceIdentityId;
  readonly geometryId: GeometryId;
  readonly occurrenceId?: OccurrenceId;
  readonly geometry: HistoricalShape;
  readonly temporal?: TemporalValue;
  readonly label: string;
  readonly category: string;
}
