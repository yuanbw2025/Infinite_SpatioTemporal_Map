<script setup lang="ts">
import type {
  HistoricalMapResource,
  MapObservation,
} from "@infinite-spacetime/contracts";
import type { FeatureCollection } from "geojson";
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
import {
  mutableGeometry,
  observationCollections,
  observationKey,
  routeCollection,
  selectionCollection,
} from "./historical-map-data";
import { addHistoricalLayers } from "./historical-map-layers";
import {
  addHistoricalReferenceResource,
  removeHistoricalReferenceResource,
  updateHistoricalReferencePresentation,
} from "./historical-reference-layers";

const props = withDefaults(
  defineProps<{
    observations: readonly MapObservation[];
    selected: MapObservation | undefined;
    journey?: readonly MapObservation[];
    showPoints?: boolean;
    showRegions?: boolean;
    showRoutes?: boolean;
    showLabels?: boolean;
    mapResources?: readonly HistoricalMapResource[];
    activeMapResourceIds?: readonly string[];
    mapResourceOpacity?: Readonly<Record<string, number>>;
  }>(),
  {
    journey: () => [],
    showPoints: true,
    showRegions: true,
    showRoutes: true,
    showLabels: true,
    mapResources: () => [],
    activeMapResourceIds: () => [],
    mapResourceOpacity: () => ({}),
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
let installedMapResources: HistoricalMapResource[] = [];

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

function indexedCollections() {
  observationIndex = new Map(
    props.observations.map((observation) => [
      observationKey(observation),
      observation,
    ]),
  );
  return observationCollections(props.observations);
}

function setSourceData(sourceId: string, data: FeatureCollection) {
  if (!map || !ready) return;
  const source = map.getSource(sourceId);
  if (source instanceof GeoJSONSource) source.setData(data);
}

function updateData() {
  const collections = indexedCollections();
  setSourceData(pointSourceId, collections.points);
  setSourceData(regionSourceId, collections.regions);
  setSourceData(routeSourceId, routeCollection(props.journey));
  setSourceData(selectedSourceId, selectionCollection(props.selected));
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
  const active = new Set(props.activeMapResourceIds);
  for (const resource of installedMapResources)
    updateHistoricalReferencePresentation(
      map!,
      resource,
      active.has(resource.id),
      props.mapResourceOpacity[resource.id] ?? resource.defaultOpacity,
    );
}

function syncMapResources() {
  if (!map || !ready) return;
  for (const resource of installedMapResources)
    removeHistoricalReferenceResource(map, resource);
  installedMapResources = [...props.mapResources];
  const beforeId = map.getLayer("historical-regions")
    ? "historical-regions"
    : undefined;
  for (const resource of installedMapResources)
    addHistoricalReferenceResource(map, resource, beforeId);
  updateVisibility();
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
  const collections = indexedCollections();
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
    data: routeCollection(props.journey),
  });
  map.addSource(selectedSourceId, {
    type: "geojson",
    data: selectionCollection(props.selected),
  });
  addHistoricalLayers(map, {
    points: pointSourceId,
    regions: regionSourceId,
    route: routeSourceId,
    selected: selectedSourceId,
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
  syncMapResources();
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
  () => setSourceData(routeSourceId, routeCollection(props.journey)),
  { deep: true },
);
watch(
  () => props.selected,
  () => {
    setSourceData(selectedSourceId, selectionCollection(props.selected));
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
watch(
  () => props.mapResources,
  () => syncMapResources(),
  { deep: true },
);
watch(
  () => [props.activeMapResourceIds, props.mapResourceOpacity],
  updateVisibility,
  { deep: true },
);

onBeforeUnmount(() => {
  map?.remove();
  map = undefined;
  ready = false;
  fallbackApplied = false;
  installedMapResources = [];
});
</script>

<template>
  <div class="historical-map-shell">
    <div ref="container" class="historical-map"></div>
    <p v-if="mapError" class="map-engine-notice">{{ mapError }}</p>
  </div>
</template>
