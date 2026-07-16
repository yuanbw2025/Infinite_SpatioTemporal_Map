<script setup lang="ts">
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
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

interface MapProperties {
  observationKey: string;
  label: string;
  category: string;
  temporal: string;
}

const props = withDefaults(
  defineProps<{
    observations: readonly MapObservation[];
    selected: MapObservation | undefined;
    journey?: readonly MapObservation[];
    showPoints?: boolean;
    showRegions?: boolean;
    showRoutes?: boolean;
    showLabels?: boolean;
  }>(),
  {
    journey: () => [],
    showPoints: true,
    showRegions: true,
    showRoutes: true,
    showLabels: true,
  },
);

const emit = defineEmits<{
  select: [observation: MapObservation];
  viewport: [
    bounds: { west: number; south: number; east: number; north: number },
  ];
}>();

const container = ref<HTMLElement>();
const mapError = ref("");
let map: MapLibreMap | undefined;
let ready = false;
let fallbackApplied = false;
let observationIndex = new Map<string, MapObservation>();

const pointSourceId = "historical-observation-points";
const regionSourceId = "historical-observation-regions";
const routeSourceId = "historical-journey-route";
const selectedSourceId = "historical-selection";

const fallbackStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "paper-background",
      type: "background",
      paint: { "background-color": "#d8dccd" },
    },
  ],
};

function observationKey(observation: MapObservation): string {
  return `${observation.geometryId}:${observation.occurrenceId ?? observation.entityId}`;
}

function mutableGeometry(
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

function observationCollections(): {
  points: FeatureCollection<Point, MapProperties>;
  regions: FeatureCollection<Polygon | MultiPolygon, MapProperties>;
} {
  observationIndex = new Map(
    props.observations.map((observation) => [
      observationKey(observation),
      observation,
    ]),
  );
  const features = props.observations.map(featureFor);
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

function routeCollection(): FeatureCollection<LineString> {
  const coordinates = props.journey.flatMap((observation) =>
    observation.geometry.type === "Point"
      ? [
          [
            observation.geometry.coordinates[0],
            observation.geometry.coordinates[1],
          ] as [number, number],
        ]
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

function selectionCollection(): FeatureCollection<Geometry> {
  return {
    type: "FeatureCollection",
    features: props.selected
      ? [
          {
            type: "Feature",
            properties: {},
            geometry: mutableGeometry(props.selected),
          },
        ]
      : [],
  };
}

function setSourceData(sourceId: string, data: FeatureCollection) {
  if (!map || !ready) return;
  const source = map.getSource(sourceId);
  if (source instanceof GeoJSONSource) source.setData(data);
}

function updateData() {
  const collections = observationCollections();
  setSourceData(pointSourceId, collections.points);
  setSourceData(regionSourceId, collections.regions);
  setSourceData(routeSourceId, routeCollection());
  setSourceData(selectedSourceId, selectionCollection());
}

function setLayerVisibility(layerIds: readonly string[], visible: boolean) {
  if (!map || !ready) return;
  for (const layerId of layerIds) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        visible ? "visible" : "none",
      );
    }
  }
}

function updateVisibility() {
  setLayerVisibility(
    ["historical-clusters", "historical-cluster-count", "historical-points"],
    props.showPoints,
  );
  setLayerVisibility(
    ["historical-regions", "historical-region-lines"],
    props.showRegions,
  );
  setLayerVisibility(["historical-routes"], props.showRoutes);
  setLayerVisibility(
    ["historical-point-labels", "historical-region-labels"],
    props.showLabels,
  );
}

function focusSelection() {
  if (!map || !ready || !props.selected) return;
  const geometry = props.selected.geometry;
  if (geometry.type === "Point") {
    map.easeTo({
      center: [geometry.coordinates[0], geometry.coordinates[1]],
      zoom: Math.max(map.getZoom(), 6),
      duration: 650,
    });
    return;
  }
  const positions =
    geometry.type === "Polygon"
      ? geometry.coordinates.flatMap((ring) => ring)
      : geometry.coordinates.flatMap((polygon) =>
          polygon.flatMap((ring) => ring),
        );
  if (!positions.length) return;
  const bounds = new LngLatBounds();
  for (const [longitude, latitude] of positions) {
    bounds.extend([longitude, latitude]);
  }
  map.fitBounds(bounds, { padding: 70, maxZoom: 9, duration: 650 });
}

function addKnowledgeLayers() {
  if (!map || ready) return;
  const collections = observationCollections();
  map.addSource(pointSourceId, {
    type: "geojson",
    data: collections.points,
    cluster: true,
    clusterMaxZoom: 10,
    clusterRadius: 46,
  });
  map.addSource(regionSourceId, {
    type: "geojson",
    data: collections.regions,
  });
  map.addSource(routeSourceId, {
    type: "geojson",
    data: routeCollection(),
  });
  map.addSource(selectedSourceId, {
    type: "geojson",
    data: selectionCollection(),
  });

  map.addLayer({
    id: "historical-regions",
    type: "fill",
    source: regionSourceId,
    paint: {
      "fill-color": "#8c3025",
      "fill-opacity": 0.16,
    },
  });
  map.addLayer({
    id: "historical-region-lines",
    type: "line",
    source: regionSourceId,
    paint: {
      "line-color": "#8c3025",
      "line-width": 1.6,
      "line-opacity": 0.72,
    },
  });
  map.addLayer({
    id: "historical-routes",
    type: "line",
    source: routeSourceId,
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
    source: pointSourceId,
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
    source: pointSourceId,
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
    source: pointSourceId,
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
    source: pointSourceId,
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
    source: regionSourceId,
    minzoom: 4,
    layout: {
      "text-field": ["get", "label"],
      "text-size": 12,
    },
    paint: {
      "text-color": "#6d2b22",
      "text-halo-color": "#fffdf7",
      "text-halo-width": 1.2,
    },
  });
  map.addLayer({
    id: "historical-selected-region",
    type: "line",
    source: selectedSourceId,
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
    source: selectedSourceId,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-color": "#f4b642",
      "circle-radius": 12,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 3,
    },
  });

  map.on("click", "historical-clusters", async (event) => {
    if (!map) return;
    const feature = map.queryRenderedFeatures(event.point, {
      layers: ["historical-clusters"],
    })[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const clusterId = Number(feature.properties?.cluster_id);
    const source = map.getSource(pointSourceId);
    if (!(source instanceof GeoJSONSource) || !Number.isFinite(clusterId))
      return;
    const zoom = await source.getClusterExpansionZoom(clusterId);
    const longitude = feature.geometry.coordinates[0];
    const latitude = feature.geometry.coordinates[1];
    if (longitude === undefined || latitude === undefined) return;
    map.easeTo({ center: [longitude, latitude], zoom });
  });

  const chooseObservation = (event: MapLayerMouseEvent) => {
    const key = event.features?.[0]?.properties?.observationKey;
    if (typeof key !== "string") return;
    const observation = observationIndex.get(key);
    if (observation) emit("select", observation);
  };
  map.on("click", "historical-points", chooseObservation);
  map.on("click", "historical-regions", chooseObservation);

  for (const layerId of [
    "historical-clusters",
    "historical-points",
    "historical-regions",
  ]) {
    map.on("mouseenter", layerId, () => {
      if (map) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      if (map) map.getCanvas().style.cursor = "";
    });
  }
  ready = true;
  updateVisibility();
  focusSelection();
}

function emitViewport() {
  if (!map) return;
  const bounds = map.getBounds();
  emit("viewport", {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  });
}

onMounted(() => {
  if (!container.value) return;
  const configuredStyle = import.meta.env.VITE_MAP_STYLE_URL;
  map = new MapLibreMap({
    container: container.value,
    style: configuredStyle || "https://tiles.openfreemap.org/styles/bright",
    center: [104, 35],
    zoom: 3.2,
    minZoom: 2,
    maxZoom: 16,
    pitchWithRotate: false,
  });
  map.addControl(new NavigationControl({ showCompass: true }), "top-right");
  map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
  map.on("load", addKnowledgeLayers);
  map.on("moveend", emitViewport);
  map.on("error", (event) => {
    if (!ready && !fallbackApplied && event.error) {
      fallbackApplied = true;
      mapError.value = "底图暂时不可用，历史数据图层仍可在本地样式中运行。";
      map?.setStyle(fallbackStyle);
      map?.once("styledata", () => {
        if (map && !ready) addKnowledgeLayers();
      });
    }
  });
});

watch(
  () => props.observations,
  () => updateData(),
  { deep: true },
);
watch(
  () => props.journey,
  () => setSourceData(routeSourceId, routeCollection()),
  { deep: true },
);
watch(
  () => props.selected,
  () => {
    setSourceData(selectedSourceId, selectionCollection());
    focusSelection();
  },
  { deep: true },
);
watch(
  () => [
    props.showPoints,
    props.showRegions,
    props.showRoutes,
    props.showLabels,
  ],
  updateVisibility,
);

onBeforeUnmount(() => {
  map?.remove();
  map = undefined;
  ready = false;
  fallbackApplied = false;
});
</script>

<template>
  <div class="historical-map-shell">
    <div ref="container" class="historical-map"></div>
    <p v-if="mapError" class="map-engine-notice">{{ mapError }}</p>
  </div>
</template>
