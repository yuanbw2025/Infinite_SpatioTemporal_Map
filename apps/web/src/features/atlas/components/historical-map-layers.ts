import type { Map as MapLibreMap } from "maplibre-gl";

export interface HistoricalSourceIds {
  points: string;
  regions: string;
  route: string;
  selected: string;
}

export function addHistoricalLayers(
  map: MapLibreMap,
  sources: HistoricalSourceIds,
): void {
  map.addLayer({
    id: "historical-regions",
    type: "fill",
    source: sources.regions,
    paint: { "fill-color": "#8c3025", "fill-opacity": 0.16 },
  });
  map.addLayer({
    id: "historical-region-lines",
    type: "line",
    source: sources.regions,
    paint: {
      "line-color": "#8c3025",
      "line-width": 1.6,
      "line-opacity": 0.72,
    },
  });
  map.addLayer({
    id: "historical-routes",
    type: "line",
    source: sources.route,
    paint: {
      "line-color": "#8c3025",
      "line-width": 3,
      "line-opacity": 0.86,
      "line-dasharray": [2, 1.4],
    },
  });
  map.addLayer({
    id: "historical-clusters",
    type: "circle",
    source: sources.points,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#31584d",
      "circle-radius": ["step", ["get", "point_count"], 17, 25, 22, 100, 28],
      "circle-stroke-color": "#fff8ec",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "historical-cluster-count",
    type: "symbol",
    source: sources.points,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 11,
    },
    paint: { "text-color": "#fff8ec" },
  });
  map.addLayer({
    id: "historical-points",
    type: "circle",
    source: sources.points,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": [
        "match",
        ["get", "category"],
        "place",
        "#31584d",
        "person",
        "#a1742d",
        "event",
        "#8c3025",
        "site",
        "#714d35",
        "artifact",
        "#6b426e",
        "#5d655f",
      ],
      "circle-radius": 7,
      "circle-stroke-color": "#fff8ec",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "historical-point-labels",
    type: "symbol",
    source: sources.points,
    filter: ["!", ["has", "point_count"]],
    minzoom: 5,
    layout: {
      "text-field": ["get", "label"],
      "text-size": 12,
      "text-offset": [0, 1.25],
      "text-anchor": "top",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#24221d",
      "text-halo-color": "#fffdf7",
      "text-halo-width": 1.3,
    },
  });
  map.addLayer({
    id: "historical-region-labels",
    type: "symbol",
    source: sources.regions,
    minzoom: 4,
    layout: { "text-field": ["get", "label"], "text-size": 12 },
    paint: {
      "text-color": "#6d2b22",
      "text-halo-color": "#fffdf7",
      "text-halo-width": 1.2,
    },
  });
  map.addLayer({
    id: "historical-selected-region",
    type: "line",
    source: sources.selected,
    filter: [
      "any",
      ["==", ["geometry-type"], "Polygon"],
      ["==", ["geometry-type"], "MultiPolygon"],
    ],
    paint: { "line-color": "#f4b642", "line-width": 4 },
  });
  map.addLayer({
    id: "historical-selected-point",
    type: "circle",
    source: sources.selected,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-color": "#f4b642",
      "circle-radius": 12,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 3,
    },
  });
}
