import type { TemporalValue } from "./common";
import type { GeometryId, HistoricalMapResourceId, SourceId } from "./ids";

interface HistoricalMapResourceBase {
  readonly id: HistoricalMapResourceId;
  readonly title: string;
  readonly validDuring?: TemporalValue;
  readonly defaultOpacity: number;
  readonly isDefault: boolean;
  readonly attribution?: string;
  readonly sourceId?: SourceId;
}

export interface RasterMapResource extends HistoricalMapResourceBase {
  readonly kind: "raster_map";
  readonly tiles: readonly [string, ...string[]];
  readonly tileSize?: 256 | 512;
  readonly minZoom?: number;
  readonly maxZoom?: number;
}

export interface BoundaryGeoJsonResource extends HistoricalMapResourceBase {
  readonly kind: "boundary_geojson";
  readonly dataUrl: string;
  readonly geometryIds: readonly [GeometryId, ...GeometryId[]];
  readonly fillColor?: string;
  readonly lineColor?: string;
}

export type HistoricalMapResource = RasterMapResource | BoundaryGeoJsonResource;

/** Rebuildable map projection bound to one immutable publication version. */
export interface HistoricalMapResourceCatalog {
  readonly version: 1;
  readonly publicationId: string;
  readonly contentChecksum: string;
  readonly generatedAt: string;
  readonly toolVersion: string;
  readonly resources: readonly HistoricalMapResource[];
}

export interface HistoricalMapResourceQuery {
  readonly temporal?: TemporalValue;
}
