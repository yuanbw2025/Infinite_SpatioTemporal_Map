<script setup>
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer, TextLayer, GeoJsonLayer } from '@deck.gl/layers'

// 项羽本纪地名数据
import locationsData from '../../public/data/xiangyu_locations.json'

const mapContainer = ref(null)
const hoveredLocation = ref(null)
const selectedLocation = ref(null)

let map = null
let deckOverlay = null

// 关键地点高亮（核心战役/事件）
const KEY_LOCATIONS = new Set([
  '垓下', '巨鹿', '鸿门', '咸阳', '彭城', '荥阳', '成皋',
  '广武', '乌江', '新安', '函谷关', '霸上', '定陶', '下相'
])

// 国名集合（用较淡颜色）
const COUNTRY_NAMES = new Set([
  '秦', '楚', '齐', '赵', '韩', '汉', '楚国', '楚地', '秦地', '秦中',
  '赵地', '江东', '河北', '河南', '江西', '山东', '关中', '三秦',
  '巴', '蜀', '梁地', '梁', '九江', '胶东'
])

// 点位颜色
function getColor(loc) {
  if (KEY_LOCATIONS.has(loc.name)) return [180, 30, 30, 230]    // 朱砂红 - 核心
  if (COUNTRY_NAMES.has(loc.name)) return [120, 100, 80, 100]   // 淡墨 - 国/区域
  return [60, 50, 40, 180]                                       // 深墨 - 普通地名
}

function getRadius(loc) {
  if (KEY_LOCATIONS.has(loc.name)) return 22000
  if (COUNTRY_NAMES.has(loc.name)) return 12000
  return 15000
}

// 构建 Deck.gl 渲染层
function buildLayers() {
  const locs = locationsData.locations || []
  
  return [
    // 地名散点
    new ScatterplotLayer({
      id: 'location-dots',
      data: locs,
      getPosition: d => [d.lng, d.lat, 150],
      getFillColor: d => {
        if (selectedLocation.value && selectedLocation.value.name === d.name) {
          return [220, 50, 30, 255]  // 选中高亮
        }
        return getColor(d)
      },
      getRadius: d => {
        if (selectedLocation.value && selectedLocation.value.name === d.name) {
          return 30000
        }
        return getRadius(d)
      },
      radiusMinPixels: 4,
      radiusMaxPixels: 25,
      pickable: true,
      parameters: { depthTest: false },
      onClick: (info) => {
        if (info.object) {
          selectedLocation.value = info.object
        }
      },
      onHover: (info) => {
        hoveredLocation.value = info.object || null
      },
      updateTriggers: {
        getFillColor: [selectedLocation.value?.name],
        getRadius: [selectedLocation.value?.name]
      }
    }),
    // 地名标签（关键地点）
    new TextLayer({
      id: 'key-labels',
      data: locs.filter(d => KEY_LOCATIONS.has(d.name)),
      getPosition: d => [d.lng, d.lat, 400],
      getText: d => d.name,
      getSize: 20,
      getColor: [139, 0, 0, 255],
      fontFamily: '"ZCOOL XiaoWei", "Noto Serif SC", serif',
      fontWeight: 'bold',
      outlineWidth: 3,
      outlineColor: [255, 252, 240, 220],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      parameters: { depthTest: false }
    }),
    // 普通地名标签（zoom>6才显示）
    new TextLayer({
      id: 'normal-labels',
      data: locs.filter(d => !KEY_LOCATIONS.has(d.name) && !COUNTRY_NAMES.has(d.name)),
      getPosition: d => [d.lng, d.lat, 300],
      getText: d => d.name,
      getSize: 14,
      getColor: [44, 40, 37, 200],
      fontFamily: '"ZCOOL XiaoWei", "Noto Serif SC", serif',
      outlineWidth: 2,
      outlineColor: [255, 252, 240, 180],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      parameters: { depthTest: false }
    }),
    // 国/区域标签
    new TextLayer({
      id: 'country-labels',
      data: locs.filter(d => COUNTRY_NAMES.has(d.name) && d.name.length <= 2),
      getPosition: d => [d.lng, d.lat, 200],
      getText: d => d.name,
      getSize: 28,
      getColor: [100, 80, 60, 120],
      fontFamily: '"ZCOOL XiaoWei", "Noto Serif SC", serif',
      fontWeight: 'bold',
      outlineWidth: 0,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      parameters: { depthTest: false }
    })
  ]
}

onMounted(() => {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center: [113.5, 34.5],  // 中原
    zoom: 5,
    pitch: 40,
    antialias: true
  })

  map.on('load', () => {
    // 3D 地形
    map.addSource('raster-dem', {
      type: 'raster-dem',
      url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
      tileSize: 256,
      maxzoom: 14
    })
    map.setTerrain({ source: 'raster-dem', exaggeration: 1.5 })

    // 天空
    map.setSky({
      'sky-type': 'gradient',
      'sky-atmosphere-sun': [0.0, 0.0],
      'sky-atmosphere-sun-intensity': 15
    })

    // 加载河流 GeoJSON
    fetch('/data/china_rivers.json')
      .then(r => r.json())
      .then(data => {
        map.addSource('china-rivers', { type: 'geojson', data })
        map.addLayer({
          id: 'rivers-layer',
          type: 'line',
          source: 'china-rivers',
          paint: {
            'line-color': '#4a7c9b',
            'line-width': 1.5,
            'line-opacity': 0.6
          }
        })
      })
      .catch(e => console.warn('河流数据加载失败:', e))

    // 加载海岸线 GeoJSON
    fetch('/data/china_coastline.json')
      .then(r => r.json())
      .then(data => {
        map.addSource('china-coast', { type: 'geojson', data })
        map.addLayer({
          id: 'coast-layer',
          type: 'line',
          source: 'china-coast',
          paint: {
            'line-color': '#2c5f7c',
            'line-width': 1.2,
            'line-opacity': 0.5
          }
        })
      })
      .catch(e => console.warn('海岸线数据加载失败:', e))

    // 初始化 Deck.gl
    deckOverlay = new MapboxOverlay({
      interleaved: true,
      layers: buildLayers()
    })
    map.addControl(deckOverlay)

    // 汉化地图标签
    localizeMap()

    // 隐藏现代城市标签（这是古代地图）
    hideModernLabels()
  })
})

onUnmounted(() => {
  if (map) map.remove()
})

function localizeMap() {
  if (!map) return
  const layers = map.getStyle().layers
  layers.forEach(layer => {
    if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', 'name_zh'],
        ['get', 'name:zh'],
        ['get', 'name'],
        layer.layout['text-field']
      ])
    }
  })
}

function hideModernLabels() {
  if (!map) return
  const layers = map.getStyle().layers
  layers.forEach(layer => {
    if (layer.type === 'symbol') {
      if (layer.id.includes('place') || layer.id.includes('city') ||
          layer.id.includes('country') || layer.id.includes('label')) {
        map.setLayoutProperty(layer.id, 'visibility', 'none')
      }
    }
  })
}

// 选中地点变化时更新图层
watch(selectedLocation, () => {
  if (deckOverlay) {
    deckOverlay.setProps({ layers: buildLayers() })
  }
})

// 关闭详情面板
function clearSelection() {
  selectedLocation.value = null
}
</script>

<template>
  <div class="map-view">
    <div ref="mapContainer" class="map-container"></div>
    
    <!-- HUD: 时代标识 -->
    <div class="hud hud-top-left animate-fade-in">
      <div class="hud-content">
        <div class="era-tag">時空斷代</div>
        <div class="year-display font-scholar">秦末楚漢</div>
        <div class="era-sub">前209 — 前202</div>
        <div class="chapter-tag">📖 史記·項羽本紀</div>
        <div class="stats">{{ locationsData.locations?.length || 0 }} 處地名已定位</div>
      </div>
    </div>

    <!-- HUD: 地点详情 -->
    <transition name="hud-slide">
      <div v-if="selectedLocation" class="hud hud-bottom-right">
        <div class="hud-header">
          <div class="seal-small">地</div>
          <span class="entity-title font-scholar">{{ selectedLocation.name }}</span>
          <button class="close-btn" @click="clearSelection">✕</button>
        </div>
        <div class="hud-body">
          <div class="coord-info">
            <span>📍 {{ selectedLocation.lng.toFixed(2) }}°E, {{ selectedLocation.lat.toFixed(2) }}°N</span>
          </div>
          <div class="source-info">
            来源: {{ selectedLocation.source === 'manual' ? '谭其骧历史地图集' :
                     selectedLocation.source === 'chgis_exact' ? 'CHGIS v6 精确匹配' :
                     selectedLocation.source === 'chgis_fuzzy' ? 'CHGIS v6 模糊匹配' : '未知' }}
          </div>
          <div class="pid-info" v-if="selectedLocation.pids">
            <div class="pid-label">出现段落:</div>
            <div class="pid-list">
              <span v-for="pid in selectedLocation.pids" :key="pid" class="pid-tag">§{{ pid }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 悬停提示 -->
    <transition name="fade">
      <div v-if="hoveredLocation && !selectedLocation" class="hover-tip">
        {{ hoveredLocation.name }}
        <small v-if="hoveredLocation.pids">({{ hoveredLocation.pids.length }}次)</small>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.map-view {
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--color-parchment-base, #f5f0e1);
}

.map-container {
  width: 100%;
  height: 100%;
}

/* HUD */
.hud {
  position: absolute;
  z-index: 100;
  pointer-events: auto;
  background: hsla(50, 45%, 90%, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(60, 50, 40, 0.3);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  border-radius: 4px;
  overflow: hidden;
}

.hud-top-left {
  top: 24px;
  left: 24px;
  padding: 16px 24px;
}

.hud-bottom-right {
  bottom: 32px;
  right: 24px;
  width: 300px;
}

.era-tag {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(60, 50, 40, 0.6);
  margin-bottom: 4px;
}

.year-display {
  font-size: 28px;
  color: #8b0000;
  font-weight: 900;
}

.era-sub {
  font-size: 13px;
  color: rgba(60, 50, 40, 0.7);
  margin-top: 2px;
}

.chapter-tag {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(60, 50, 40, 0.8);
}

.stats {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(60, 50, 40, 0.5);
}

.hud-header {
  padding: 12px 16px;
  background: rgba(60, 50, 40, 0.08);
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(60, 50, 40, 0.15);
}

.seal-small {
  width: 22px;
  height: 22px;
  background: #8b0000;
  color: white;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  flex-shrink: 0;
}

.entity-title {
  font-size: 18px;
  font-weight: bold;
  flex: 1;
}

.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: rgba(60, 50, 40, 0.5);
  padding: 4px 8px;
}

.close-btn:hover {
  color: #8b0000;
}

.hud-body {
  padding: 16px;
}

.coord-info {
  font-size: 12px;
  color: rgba(60, 50, 40, 0.7);
  margin-bottom: 8px;
}

.source-info {
  font-size: 11px;
  color: rgba(60, 50, 40, 0.5);
  margin-bottom: 12px;
}

.pid-label {
  font-size: 11px;
  color: rgba(60, 50, 40, 0.6);
  margin-bottom: 6px;
}

.pid-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pid-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(139, 0, 0, 0.1);
  color: #8b0000;
  border-radius: 10px;
  border: 1px solid rgba(139, 0, 0, 0.2);
}

/* 悬停提示 */
.hover-tip {
  position: absolute;
  top: 24px;
  right: 24px;
  background: hsla(50, 45%, 90%, 0.92);
  backdrop-filter: blur(8px);
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  color: #2c2825;
  border: 1px solid rgba(60, 50, 40, 0.2);
  pointer-events: none;
  z-index: 100;
}

.hover-tip small {
  font-weight: normal;
  color: rgba(60, 50, 40, 0.5);
  margin-left: 4px;
}

/* Transitions */
.hud-slide-enter-active, .hud-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.hud-slide-enter-from, .hud-slide-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.animate-fade-in {
  animation: fadeIn 0.6s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
