<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ArcLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import officialsData from './data/qinghe_officials.json'

const mapContainer = ref(null)
const currentYear = ref(1700)
const hoveredOfficial = ref(null)
const selectedDynasty = ref('全部')
const showAll = ref(true)

let map = null
let deckOverlay = null

const dynasties = ['全部', '東漢', '北魏', '東魏', '隋', '唐', '後晉', '宋', '明', '明/清', '清']
const dynastyColors = {
  '東漢': '#ff5050',
  '北魏': '#b464ff',
  '東魏': '#b464ff',
  '隋': '#00c896',
  '唐': '#ff7832',
  '後晉': '#ffb400',
  '宋': '#50b4ff',
  '明': '#dc3232',
  '明/清': '#dc3232',
  '清': '#6464ff'
}

const dest = officialsData.meta.destination.lng_lat

const filteredOfficials = computed(() => {
  return officialsData.officials.filter(o => {
    const yearMatch = showAll.value || (currentYear.value >= o.year_start && currentYear.value <= o.year_end)
    const dynastyMatch = selectedDynasty.value === '全部' || o.dynasty === selectedDynasty.value
    return yearMatch && dynastyMatch
  })
})

function buildLayers() {
  const data = filteredOfficials.value
  return [

    new ArcLayer({
      id: 'arc-layer',
      data,
      getSourcePosition: d => d.origin_lnglat,
      getTargetPosition: () => dest,
      getSourceColor: d => [...d.color, 200],
      getTargetColor: d => [...d.color, 200],
      getWidth: 2.5,
      greatCircle: true,
      pickable: true,
      onHover: info => {
        hoveredOfficial.value = info.object || null
      }
    }),
    new ScatterplotLayer({
      id: 'origin-dots',
      data,
      getPosition: d => d.origin_lnglat,
      getFillColor: d => [...d.color, 220],
      getRadius: 18000,
      radiusMinPixels: 5,
      radiusMaxPixels: 15,
      pickable: true,
      onHover: info => {
        hoveredOfficial.value = info.object || null
      }
    }),
    new ScatterplotLayer({
      id: 'dest-dot',
      data: [{ position: dest }],
      getPosition: d => d.position,
      getFillColor: [255, 255, 100, 255],
      getRadius: 25000,
      radiusMinPixels: 8,
      radiusMaxPixels: 20,
      stroked: true,
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 2
    }),
    new TextLayer({
      id: 'origin-labels',
      data,
      getPosition: d => d.origin_lnglat,
      getText: d => d.origin,
      getSize: 14,
      getColor: [255, 255, 255, 220],
      getTextAnchor: 'start',
      getAlignmentBaseline: 'bottom',
      getPixelOffset: [10, -10],
      fontFamily: 'serif',
      fontWeight: 'bold',
      outlineWidth: 3,
      outlineColor: [0, 0, 0, 200]
    }),
    new TextLayer({
      id: 'dest-label',
      data: [{ position: dest, text: '清河縣（今邢台清河）' }],
      getPosition: d => d.position,
      getText: d => d.text,
      getSize: 16,
      getColor: [255, 255, 100, 255],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      getPixelOffset: [0, -20],
      fontFamily: 'serif',
      fontWeight: 'bold',
      outlineWidth: 3,
      outlineColor: [0, 0, 0, 220]
    })
  ]
}

function updateDeckLayers() {
  if (!deckOverlay) return
  deckOverlay.setProps({ layers: buildLayers() })
}

onMounted(() => {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: [
            'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
          ],
          tileSize: 256,
          attribution: '© CartoDB © OpenStreetMap'
        }
      },
      layers: [{
        id: 'base-tiles',
        type: 'raster',
        source: 'raster-tiles',
        minzoom: 0,
        maxzoom: 19
      }]
    },
    center: [112, 35],
    zoom: 4.5,
    pitch: 35,
    bearing: -5,
    antialias: true
  })

  map.on('load', () => {
    deckOverlay = new MapboxOverlay({
      interleaved: false,
      layers: buildLayers()
    })
    map.addControl(deckOverlay)
  })
})

onUnmounted(() => {
  if (map) map.remove()
})

function onYearChange(e) {
  currentYear.value = parseInt(e.target.value)
  showAll.value = false
  updateDeckLayers()
}

function onDynastyChange(dynasty) {
  selectedDynasty.value = dynasty
  updateDeckLayers()
}

function toggleShowAll() {
  showAll.value = !showAll.value
  updateDeckLayers()
}
</script>

<template>
  <div class="app-container">
    <!-- 标题栏 -->
    <header class="top-bar">
      <h1>無限時空圖 <span class="subtitle">· 清河縣志官師表</span></h1>
      <p class="source-tag">數據來源：【萬曆】清河縣志 卷七</p>
    </header>

    <!-- 地图 -->
    <div ref="mapContainer" class="map-container"></div>

    <!-- 时间轴面板 -->
    <div class="timeline-panel">
      <div class="year-display">
        <span class="year-num" v-if="!showAll">{{ currentYear }}</span>
        <span class="year-num" v-else>全部</span>
        <span class="year-label" v-if="!showAll">年 (公元)</span>
        <button class="show-all-btn" @click="toggleShowAll">
          {{ showAll ? '🕐 啟用時間過濾' : '📋 顯示全部' }}
        </button>
      </div>
      <input
        type="range"
        :min="-200"
        :max="1700"
        :value="currentYear"
        @input="onYearChange"
        class="time-slider"
        :class="{ dimmed: showAll }"
      />
      <div class="slider-labels">
        <span>前200</span>
        <span>500</span>
        <span>1000</span>
        <span>1700</span>
      </div>
    </div>

    <!-- 朝代筛选 -->
    <div class="dynasty-panel">
      <button
        v-for="d in dynasties"
        :key="d"
        :class="['dynasty-btn', { active: selectedDynasty === d }]"
        :style="d !== '全部' ? { borderColor: dynastyColors[d] } : {}"
        @click="onDynastyChange(d)"
      >
        {{ d }}
      </button>
    </div>

    <!-- 悬停信息 -->
    <div v-if="hoveredOfficial" class="hover-card">
      <div class="card-name">{{ hoveredOfficial.name }}</div>
      <div class="card-row"><span class="label">朝代</span>{{ hoveredOfficial.dynasty }}</div>
      <div class="card-row"><span class="label">籍貫</span>{{ hoveredOfficial.origin }}</div>
      <div class="card-row"><span class="label">職位</span>{{ hoveredOfficial.position }}</div>
      <div class="card-row" v-if="hoveredOfficial.note"><span class="label">備注</span>{{ hoveredOfficial.note }}</div>
      <div class="card-years">{{ hoveredOfficial.year_start }} — {{ hoveredOfficial.year_end }} 年</div>
    </div>

    <!-- 统计面板 -->
    <div class="stats-panel">
      <div class="stat-item">
        <span class="stat-num">{{ filteredOfficials.length }}</span>
        <span class="stat-label">位官員</span>
      </div>
    </div>
  </div>
</template>

<style>
@import 'maplibre-gl/dist/maplibre-gl.css';

* { margin: 0; padding: 0; box-sizing: border-box; }

body, html, #app {
  width: 100%; height: 100%;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  background: #0a0a12;
  color: #e0e0e0;
  overflow: hidden;
}

.app-container {
  width: 100vw; height: 100vh;
  position: relative;
}

.map-container {
  width: 100%; height: 100%;
  position: absolute; top: 0; left: 0;
}

.top-bar {
  position: absolute; top: 0; left: 0; right: 0;
  padding: 16px 24px;
  background: linear-gradient(to bottom, rgba(10,10,18,0.9), transparent);
  z-index: 10;
  pointer-events: none;
}

.top-bar h1 {
  font-size: 22px;
  font-weight: 700;
  color: #f0e6d0;
  letter-spacing: 4px;
}

.top-bar .subtitle {
  font-size: 14px;
  color: #a89878;
  font-weight: 400;
  letter-spacing: 1px;
}

.source-tag {
  font-size: 11px;
  color: #706050;
  margin-top: 4px;
}

.timeline-panel {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  max-width: 90vw;
  background: rgba(15, 15, 25, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px 24px;
  z-index: 10;
}

.year-display {
  text-align: center;
  margin-bottom: 8px;
}

.year-num {
  font-size: 32px;
  font-weight: 700;
  color: #f0d080;
  font-family: 'Georgia', serif;
}

.year-label {
  font-size: 12px;
  color: #888;
  margin-left: 6px;
}

.time-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(to right, #ff5050, #b464ff, #00c896, #ff7832, #ffb400, #50b4ff, #dc3232);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.time-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #f0d080;
  border: 2px solid #fff;
  box-shadow: 0 0 10px rgba(240,208,128,0.5);
  cursor: grab;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #666;
  margin-top: 4px;
}

.show-all-btn {
  margin-left: 12px;
  padding: 3px 10px;
  font-size: 11px;
  background: rgba(240, 208, 128, 0.15);
  border: 1px solid rgba(240, 208, 128, 0.3);
  border-radius: 4px;
  color: #f0d080;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.show-all-btn:hover {
  background: rgba(240, 208, 128, 0.25);
}

.time-slider.dimmed {
  opacity: 0.3;
  pointer-events: none;
}

.dynasty-panel {
  position: absolute;
  top: 80px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
}

.dynasty-btn {
  padding: 4px 12px;
  font-size: 12px;
  background: rgba(15,15,25,0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  color: #ccc;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.dynasty-btn:hover { background: rgba(255,255,255,0.1); }
.dynasty-btn.active {
  background: rgba(255,255,255,0.15);
  color: #fff;
  border-color: rgba(255,255,255,0.4);
}

.hover-card {
  position: absolute;
  top: 80px;
  left: 16px;
  width: 240px;
  background: rgba(15,15,25,0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 16px;
  z-index: 10;
}

.card-name {
  font-size: 20px;
  font-weight: 700;
  color: #f0e6d0;
  margin-bottom: 10px;
  letter-spacing: 2px;
}

.card-row {
  font-size: 13px;
  margin-bottom: 4px;
  color: #bbb;
}

.card-row .label {
  display: inline-block;
  width: 42px;
  color: #888;
  font-size: 11px;
}

.card-years {
  margin-top: 10px;
  font-size: 12px;
  color: #f0d080;
  text-align: right;
}

.stats-panel {
  position: absolute;
  bottom: 100px;
  right: 16px;
  background: rgba(15,15,25,0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 10px 16px;
  z-index: 10;
}

.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: #f0d080;
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-left: 4px;
}
</style>
