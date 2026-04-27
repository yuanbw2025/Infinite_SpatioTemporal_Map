<script setup>
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'

// Data
import officialsData from '../data/biographies_data.json'
import historicalPlaces from '../data/historical_places.json'
import { mockArticle } from '../data/mock_article.js'

// Components
import TimelineSlider from '../components/TimelineSlider.vue'

const mapContainer = ref(null)
const currentDate = ref(1700) // 核心时间变量，统一使用 currentDate
const hoveredOfficial = ref(null)
const activeEntityName = ref(null)

const dest = [108.3122, 22.8058] // 南宁默认坐标

let map = null
let deckOverlay = null

// 计算属性：根据当前时间筛选历史实体
const filteredEntities = computed(() => {
  const all = officialsData.data || []
  return all.filter(entity => {
    return entity.events.some(event => event.year <= currentDate.value)
  })
})

// 计算属性：生成路径数据 (带 Z 轴偏移防止地形遮挡)
const pathData = computed(() => {
  return filteredEntities.value.map(entity => ({
    name: entity.name,
    color: entity.color || [200, 200, 200],
    // 轨迹线提升 50 米，确保在地形之上
    path: entity.events
      .filter(ev => ev.year <= currentDate.value && ev.lnglat)
      .map(ev => [ev.lnglat[0], ev.lnglat[1], 100])
  })).filter(d => d.path.length > 1)
})

// 计算属性：生成点位数据 (带 Z 轴偏移)
const pointData = computed(() => {
  const points = []
  filteredEntities.value.forEach(entity => {
    entity.events.forEach(event => {
      if (event.year <= currentDate.value && event.lnglat) {
        points.push({
          position: [event.lnglat[0], event.lnglat[1], 150], // 点位提升 150 米
          entity,
          event
        })
      }
    })
  })
  return points
})

// 计算属性：当前时间段的历史地名
const currentHistoricalLabels = computed(() => {
  return historicalPlaces.map(place => {
    const period = place.history.find(h => currentDate.value >= h.start && currentDate.value <= h.end)
    return {
      coordinates: place.coordinates,
      name: period ? period.name : ''
    }
  }).filter(p => p.name !== '')
})

// 构建 Deck.gl 渲染层
function buildLayers() {
  return [
    new PathLayer({
      id: 'path-layer',
      data: pathData.value,
      getPath: d => d.path,
      getColor: d => {
        const opacity = (activeEntityName.value && d.name === activeEntityName.value) ? 255 : 120
        return [...d.color, opacity]
      },
      widthMinPixels: 4,
      getWidth: d => (activeEntityName.value && d.name === activeEntityName.value) ? 10 : 4,
      pickable: true,
      parameters: { depthTest: false },
      transitions: {
        getPath: 600,
        getColor: 300
      }
    }),
    new ScatterplotLayer({
      id: 'event-dots',
      data: pointData.value,
      getPosition: d => d.position,
      getFillColor: d => {
        const opacity = (activeEntityName.value && d.entity.name === activeEntityName.value) ? 255 : 100
        return [...d.entity.color, opacity]
      },
      getRadius: 15000,
      radiusMinPixels: 6,
      radiusMaxPixels: 30,
      pickable: true,
      parameters: { depthTest: false },
      // 增加缩放动画
      transitions: {
        getPosition: 600,
        getFillColor: 300,
        getRadius: 300
      }
    }),
    new TextLayer({
      id: 'historical-labels',
      data: currentHistoricalLabels.value,
      getPosition: d => [d.coordinates[0], d.coordinates[1], 300], // 标签提升 300 米
      getText: d => d.name,
      getSize: 24,
      getColor: [44, 40, 37, 255], // 深墨色
      fontFamily: '"ZCOOL XiaoWei", serif',
      fontWeight: 'bold',
      outlineWidth: 4,
      outlineColor: [255, 252, 240, 220],
      updateTriggers: { data: [currentDate.value] }
    }),
    new TextLayer({
      id: 'dest-label',
      data: [{ position: dest, text: currentDate.value < 1324 ? '邕州' : '南寧府' }],
      getPosition: d => [d.position[0], d.position[1], 500],
      getText: d => d.text,
      getSize: 28,
      getColor: [139, 0, 0], // 朱砂红
      fontFamily: 'serif',
      fontWeight: 'bold',
      outlineWidth: 4,
      outlineColor: [255, 252, 240, 200]
    })
  ]
}

onMounted(() => {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center: [108.3122, 22.8058],
    zoom: 6,
    pitch: 45,
    antialias: true
  })

  map.on('load', () => {
    // 挂载 3D 地形
    map.addSource('raster-dem', {
      'type': 'raster-dem',
      'url': 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
      'tileSize': 256,
      'maxzoom': 14
    });
    map.setTerrain({ 'source': 'raster-dem', 'exaggeration': 1.5 });

    // 天空层
    map.setSky({
      'sky-type': 'gradient',
      'sky-atmosphere-sun': [0.0, 0.0],
      'sky-atmosphere-sun-intensity': 15
    });

    // 初始化 Deck.gl 层
    deckOverlay = new MapboxOverlay({
      interleaved: true,
      layers: buildLayers()
    })
    map.addControl(deckOverlay)

    // 初始汉化
    localizeMap()
  })
})

onUnmounted(() => {
  if (map) map.remove()
})

// 地图汉化逻辑
function localizeMap() {
  if (!map) return
  const layers = map.getStyle().layers
  layers.forEach(layer => {
    if (layer.type === 'symbol' && layer.layout['text-field']) {
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

// 核心监听：时间轴变迁导致的地名穿越与标签显隐
watch(currentDate, (newVal) => {
  if (!map || !map.getStyle()) return
  
  // 更新 Deck.gl 层
  if (deckOverlay) {
    deckOverlay.setProps({ layers: buildLayers() })
  }

  // 动态显隐现代标签
  const isModern = newVal >= 1912
  const layers = map.getStyle().layers
  layers.forEach(layer => {
    if (layer.type === 'symbol' && !layer.id.startsWith('historical')) {
      if (layer.id.includes('place') || layer.id.includes('city') || layer.id.includes('country') || layer.id.includes('label')) {
        map.setLayoutProperty(layer.id, 'visibility', isModern ? 'visible' : 'none')
      }
    }
  })
})

const onDateChange = (newVal) => {
  currentDate.value = newVal
}
</script>

<template>
  <div class="map-view">
    <div ref="mapContainer" class="map-container"></div>
    
    <!-- 时空断代面板 (右上角) -->
    <div class="dynasty-panel">
      <div class="dynasty-label">
        <span class="era-title">時空斷代</span>
        <span class="current-year">{{ Math.floor(currentDate) }} 年</span>
      </div>
      <div class="dynasty-hint">滑动下方时间轴进行穿越</div>
    </div>

    <!-- 重新接入 TimelineSlider 组件 (底部居中) -->
    <TimelineSlider 
      :currentDate="currentDate" 
      :showAll="false"
      :activeEntity="null"
      @update:currentDate="onDateChange"
    />

    <!-- 实体交互卡片 -->
    <div v-if="hoveredOfficial" class="hover-card">
      <div class="card-name">{{ hoveredOfficial.name }}</div>
      <div v-if="hoveredOfficial.current_event" class="card-event">
        <div class="event-meta">
          <span class="event-time">{{ hoveredOfficial.current_event.time_desc }}</span>
          <span class="event-loc">{{ hoveredOfficial.current_event.location }}</span>
        </div>
        <div class="event-action">{{ hoveredOfficial.current_event.action }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-view {
  width: 100%;
  height: 100%;
  position: relative;
  background: #f5f0d6; /* 备用羊皮纸底色 */
}

.map-container {
  width: 100%;
  height: 100%;
}

.dynasty-panel {
  position: absolute;
  top: 24px;
  right: 24px;
  background: rgba(255, 252, 240, 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(139, 0, 0, 0.3);
  border-radius: 8px;
  padding: 16px;
  width: 240px;
  z-index: 10;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.dynasty-hint {
  font-size: 11px;
  color: #8c7f55;
  text-align: right;
  font-style: italic;
}

.dynasty-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
  border-bottom: 2px solid #8b0000;
  padding-bottom: 8px;
}

.era-title {
  font-size: 14px;
  color: #5c5346;
  font-weight: bold;
}

.current-year {
  font-size: 24px;
  font-weight: 800;
  color: #8b0000;
  font-family: 'Georgia', serif;
}

.hover-card {
  position: absolute;
  top: 24px;
  left: 24px;
  background: rgba(255, 252, 240, 0.95);
  border-left: 5px solid #8b0000;
  border-radius: 4px;
  padding: 20px;
  width: 300px;
  color: #2c2825;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  z-index: 20;
}

.card-name {
  font-size: 24px;
  font-weight: 900;
  color: #2c2825;
  margin-bottom: 12px;
  font-family: "ZCOOL XiaoWei", serif;
}

.event-meta {
  font-size: 13px;
  color: #8b0000;
  margin-bottom: 8px;
  display: flex;
  gap: 12px;
}

.event-action {
  font-size: 15px;
  line-height: 1.6;
  color: #4a4a4a;
}
</style>
