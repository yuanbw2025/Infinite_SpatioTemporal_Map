<script setup lang="ts">
import { onMounted, inject, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';
import maplibregl from 'maplibre-gl';

const map = inject<Ref<maplibregl.Map | null>>('mapInstance');
const isLoaded = inject<Ref<boolean>>('isMapLoaded');

// Mock Data for Phase 0: 3 unique paths representing "Migration tracks"
const MOCK_TRIPS = [
  {
    id: 'track_1',
    vendor: 0,
    path: [
      [114.3055, 30.5928], // Wuhan
      [113.6253, 34.7466], // Zhengzhou
      [116.4074, 39.9042]  // Beijing
    ],
    timestamps: [0, 100, 200]
  },
  {
    id: 'track_2',
    vendor: 1,
    path: [
      [121.4737, 31.2304], // Shanghai
      [118.7969, 32.0603], // Nanjing
      [117.2272, 31.8206]  // Hefei
    ],
    timestamps: [50, 150, 250]
  }
];

let currentTime = 0;
let animationId: number;
let overlay: MapboxOverlay | null = null;

const animate = () => {
  currentTime = (currentTime + 1) % 300;
  
  if (overlay) {
    overlay.setProps({
      layers: [
        new TripsLayer({
          id: 'trips-layer',
          data: MOCK_TRIPS,
          getPath: (d: any) => d.path,
          getTimestamps: (d: any) => d.timestamps,
          getColor: (d: any) => (d.vendor === 0 ? [253, 128, 93] : [23, 184, 190]),
          opacity: 0.8,
          widthMinPixels: 4,
          rounded: true,
          trailLength: 50,
          currentTime,
          shadowEnabled: false
        })
      ]
    });
  }
  
  animationId = requestAnimationFrame(animate);
};

onMounted(() => {
  if (!map?.value || !isLoaded?.value) return;

  overlay = new MapboxOverlay({
    layers: []
  });

  map.value.addControl(overlay as any);
  
  // Start animation
  animate();
});

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
  if (map?.value && map.value.getLayer('trips-layer')) {
    map.value.removeLayer('trips-layer');
  }
});
</script>

<template>
  <div class="overlay-info">
    <h3>Phase 0: 3D 时空轨迹点亮测试</h3>
    <p>正在渲染参考 deck.gl 的动态 TripsLayer...</p>
  </div>
</template>

<style scoped>
.overlay-info {
  position: absolute;
  top: 20px;
  left: 20px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  color: white;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

h3 {
  margin: 0 0 8px 0;
  color: #ff9d00;
}

p {
  margin: 0;
  font-size: 14px;
  opacity: 0.8;
}
</style>
