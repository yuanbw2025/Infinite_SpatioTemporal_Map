import type * as Wire from "./generated/publication";
import type { EvidenceSpan, TemporalValue } from "./common";
import type { SourceRef } from "./catalog";
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

export type HistoricalGeometry = Readonly<
  Omit<
    Wire.HistoricalGeometry,
    "id" | "placeId" | "geometry" | "validDuring" | "sourceRefs"
  > & {
    readonly id: GeometryId;
    readonly placeId: PlaceIdentityId;
    readonly geometry: HistoricalShape;
    readonly validDuring?: TemporalValue;
    readonly sourceRefs: readonly [SourceRef, ...SourceRef[]];
  }
>;

export type HistoricalName = Readonly<
  Omit<Wire.HistoricalName, "validDuring" | "evidence" | "sourceRefs"> & {
    readonly validDuring?: TemporalValue;
    readonly evidence: readonly EvidenceSpan[];
    readonly sourceRefs: readonly SourceRef[];
  }
>;

export type PlaceIdentity = Readonly<
  Omit<
    Wire.PlaceIdentity,
    "id" | "entityId" | "historicalNames" | "parentPlaceIds"
  > & {
    readonly id: PlaceIdentityId;
    readonly entityId: EntityId;
    readonly historicalNames: readonly HistoricalName[];
    readonly parentPlaceIds: readonly PlaceIdentityId[];
  }
>;

export type OccurrenceKind = Wire.OccurrenceKind;

export type SpatiotemporalOccurrence = Readonly<
  Omit<
    Wire.SpatiotemporalOccurrence,
    "id" | "entityId" | "placeId" | "temporal" | "evidence"
  > & {
    readonly id: OccurrenceId;
    readonly entityId: EntityId;
    readonly placeId: PlaceIdentityId;
    readonly temporal?: TemporalValue;
    readonly evidence: readonly [EvidenceSpan, ...EvidenceSpan[]];
  }
>;

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
