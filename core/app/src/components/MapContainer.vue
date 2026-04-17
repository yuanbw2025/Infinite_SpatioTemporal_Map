<script setup lang="ts">
import { onMounted, ref, provide } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const mapContainer = ref<HTMLElement | null>(null);
const map = ref<maplibregl.Map | null>(null);
const isMapLoaded = ref(false);

// Provide map instance to child components (like TripVisualization)
provide('mapInstance', map);
provide('isMapLoaded', isMapLoaded);

onMounted(() => {
  if (!mapContainer.value) return;

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    // Using a clean, open-source style (Positron by Carto)
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [114.3055, 30.5928],
    zoom: 5,
    pitch: 45
  });

  // @ts-ignore: maplibre-gl types can be excessively deep
  map.value.on('load', () => {
    isMapLoaded.value = true;
    console.log('MapLibre loaded');
    
    // Add terrain if needed later (MapLibre supports RGB terrain)
  });
});
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map-container"></div>
    <!-- Deck.gl layer will be injected here by child components -->
    <slot v-if="isMapLoaded"></slot>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.map-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
