import type { HistoricalMapResource } from "@infinite-spacetime/contracts";
import type { Map as MapLibreMap } from "maplibre-gl";

export function resourceSourceId(resource: HistoricalMapResource): string {
  return `historical-resource-source-${resource.id}`;
}

export function resourceLayerIds(
  resource: HistoricalMapResource,
): readonly string[] {
  const prefix = `historical-resource-layer-${resource.id}`;
  return resource.kind === "raster_map"
    ? [prefix]
    : [`${prefix}-fill`, `${prefix}-line`];
}

export function addHistoricalReferenceResource(
  map: MapLibreMap,
  resource: HistoricalMapResource,
  beforeId?: string,
): void {
  const sourceId = resourceSourceId(resource);
  const layerIds = resourceLayerIds(resource);
  if (resource.kind === "raster_map") {
    map.addSource(sourceId, {
      type: "raster",
      tiles: [...resource.tiles],
      tileSize: resource.tileSize ?? 256,
      ...(resource.minZoom === undefined ? {} : { minzoom: resource.minZoom }),
      ...(resource.maxZoom === undefined ? {} : { maxzoom: resource.maxZoom }),
      ...(resource.attribution ? { attribution: resource.attribution } : {}),
    });
    map.addLayer(
      {
        id: layerIds[0]!,
        type: "raster",
        source: sourceId,
        paint: { "raster-opacity": resource.defaultOpacity },
      },
      beforeId,
    );
    return;
  }
  map.addSource(sourceId, {
    type: "geojson",
    data: resource.dataUrl,
    ...(resource.attribution ? { attribution: resource.attribution } : {}),
  });
  map.addLayer(
    {
      id: layerIds[0]!,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": resource.fillColor ?? "#806f4f",
        "fill-opacity": resource.defaultOpacity,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: layerIds[1]!,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": resource.lineColor ?? "#5f4d32",
        "line-width": 1.3,
        "line-opacity": Math.min(1, resource.defaultOpacity + 0.25),
      },
    },
    beforeId,
  );
}

export function removeHistoricalReferenceResource(
  map: MapLibreMap,
  resource: HistoricalMapResource,
): void {
  for (const layerId of resourceLayerIds(resource).toReversed()) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  const sourceId = resourceSourceId(resource);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

export function updateHistoricalReferencePresentation(
  map: MapLibreMap,
  resource: HistoricalMapResource,
  visible: boolean,
  opacity: number,
): void {
  const layerIds = resourceLayerIds(resource);
  for (const layerId of layerIds) {
    if (map.getLayer(layerId))
      map.setLayoutProperty(
        layerId,
        "visibility",
        visible ? "visible" : "none",
      );
  }
  const normalizedOpacity = Math.min(1, Math.max(0, opacity));
  if (resource.kind === "raster_map") {
    if (map.getLayer(layerIds[0]!))
      map.setPaintProperty(layerIds[0]!, "raster-opacity", normalizedOpacity);
    return;
  }
  if (map.getLayer(layerIds[0]!))
    map.setPaintProperty(layerIds[0]!, "fill-opacity", normalizedOpacity);
  if (map.getLayer(layerIds[1]!))
    map.setPaintProperty(
      layerIds[1]!,
      "line-opacity",
      Math.min(1, normalizedOpacity + 0.25),
    );
}
