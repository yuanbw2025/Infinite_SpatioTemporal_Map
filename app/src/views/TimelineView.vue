<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoading = ref(true)
const rawData = ref(null)
const timelineEvents = ref([])
const chapterIndex = ref({})

// 时间范围定义
const MIN_YEAR = -2200 // 约夏朝开始
const MAX_YEAR = 1912  // 清末
const PIXELS_PER_YEAR = 4 // 每年的像素宽度

async function loadData() {
  try {
    const [graphRes, indexRes] = await Promise.all([
      fetch('/data/TOTAL_ERSHISI_CLEAN_DATA.json'),
      fetch('/data/ershisi_index.json')
    ])
    
    const data = await graphRes.json()
    const indexData = await indexRes.json()
    rawData.value = data
    
    // 映射标题
    indexData.catalog.forEach(item => {
      chapterIndex.value[item.real_file] = item.chapter
    })

    // 提取带公元年的事件
    const events = []
    const yearRegex = /（(\d+)年/
    
    data.graph.forEach(chapter => {
      chapter.data.times.forEach(timeStr => {
        const match = timeStr.match(yearRegex)
        if (match) {
          const year = parseInt(match[1])
          // 简单逻辑：提取该章节中第一个人名作为主要关联实体
          const entity = chapter.data.persons[0] || chapter.data.places[0] || '未知事件'
          events.push({
            year,
            label: entity,
            description: timeStr,
            fileName: chapter.file,
            chapterTitle: chapterIndex.value[chapter.file] || '未命名章节'
          })
        }
      })
    })

    // 按年份排序
    timelineEvents.value = events.sort((a, b) => a.year - b.year)
    isLoading.value = false
  } catch (err) {
    console.error('Failed to load timeline data:', err)
  }
}

const viewportWidth = computed(() => (MAX_YEAR - MIN_YEAR) * PIXELS_PER_YEAR)

function getX(year) {
  return (year - MIN_YEAR) * PIXELS_PER_YEAR
}

function goToSource(fileName) {
  router.push({ name: 'reader', query: { book: 'ershisishe', file: fileName } })
}

onMounted(loadData)
</script>

<template>
  <div class="timeline-container">
    <div class="timeline-header">
      <h1>🚇 歷史時空地鐵圖</h1>
      <p>基於公元紀年自動歸算的二十四史編年可視化</p>
    </div>

    <div class="timeline-viewport" v-if="!isLoading">
      <div class="timeline-canvas" :style="{ width: viewportWidth + 'px' }">
        <!-- 时间轴底线 -->
        <div class="time-axis">
          <div 
            v-for="year in Array.from({length: (MAX_YEAR - MIN_YEAR)/100 + 1}, (_, i) => MIN_YEAR + i*100)" 
            :key="year"
            class="year-marker"
            :style="{ left: getX(year) + 'px' }"
          >
            <span class="year-label">{{ year < 0 ? 'BC ' + Math.abs(year) : 'AD ' + year }}</span>
            <div class="tick"></div>
          </div>
        </div>

        <!-- 事件节点 -->
        <div 
          v-for="(event, index) in timelineEvents" 
          :key="index"
          class="event-node"
          :style="{ 
            left: getX(event.year) + 'px', 
            top: (200 + (index % 10) * 40) + 'px' 
          }"
          @click="goToSource(event.fileName)"
        >
          <div class="node-dot"></div>
          <div class="node-content">
            <span class="node-year">{{ event.year }}</span>
            <span class="node-label">{{ event.label }}</span>
            <div class="node-tooltip">
              <strong>{{ event.chapterTitle }}</strong>
              <p>{{ event.description }}</p>
              <div class="hint">點擊跳轉閱讀原文</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="loading">正在归算时空坐标...</div>
  </div>
</template>

<style scoped>
.timeline-container {
  width: 100%;
  height: 100%;
  background: #1a1816;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timeline-header {
  padding: 20px 40px;
  background: rgba(0,0,0,0.3);
  border-bottom: 1px solid rgba(240, 208, 128, 0.1);
}

.timeline-header h1 {
  color: #f0d080;
  font-size: 24px;
  margin: 0;
}

.timeline-header p {
  color: #888;
  font-size: 14px;
  margin: 8px 0 0 0;
}

.timeline-viewport {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;
  background-image: 
    linear-gradient(rgba(240, 208, 128, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(240, 208, 128, 0.05) 1px, transparent 1px);
  background-size: 100px 100px;
}

.timeline-canvas {
  height: 100%;
  position: relative;
  min-height: 800px;
}

.time-axis {
  position: absolute;
  top: 100px;
  width: 100%;
  height: 2px;
  background: rgba(240, 208, 128, 0.3);
}

.year-marker {
  position: absolute;
  height: 40px;
  border-left: 1px dashed rgba(240, 208, 128, 0.3);
}

.year-label {
  position: absolute;
  top: -30px;
  left: 5px;
  color: #f0d080;
  font-size: 12px;
  white-space: nowrap;
}

.tick {
  width: 1px;
  height: 10px;
  background: #f0d080;
}

.event-node {
  position: absolute;
  cursor: pointer;
  z-index: 10;
}

.node-dot {
  width: 10px;
  height: 10px;
  background: #c93756;
  border: 2px solid #fff;
  border-radius: 50%;
  transition: all 0.3s;
}

.event-node:hover .node-dot {
  transform: scale(1.5);
  box-shadow: 0 0 10px #c93756;
}

.node-content {
  position: absolute;
  top: -10px;
  left: 15px;
  white-space: nowrap;
}

.node-year {
  font-size: 10px;
  color: #888;
  display: block;
}

.node-label {
  font-size: 13px;
  color: #f0d080;
  font-weight: bold;
}

.node-tooltip {
  position: absolute;
  bottom: 30px;
  left: 0;
  background: rgba(26, 24, 22, 0.95);
  border: 1px solid #f0d080;
  padding: 10px;
  border-radius: 4px;
  color: #fff;
  width: 250px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s;
  z-index: 100;
  white-space: normal;
}

.event-node:hover .node-tooltip {
  opacity: 1;
  visibility: visible;
  bottom: 40px;
}

.node-tooltip strong {
  color: #f0d080;
  display: block;
  margin-bottom: 5px;
}

.node-tooltip p {
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
}

.hint {
  margin-top: 8px;
  font-size: 10px;
  color: #c93756;
  text-align: right;
}

.loading {
  padding: 100px;
  text-align: center;
  color: #f0d080;
}

.timeline-viewport::-webkit-scrollbar {
  height: 10px;
}
.timeline-viewport::-webkit-scrollbar-track {
  background: #1a1816;
}
.timeline-viewport::-webkit-scrollbar-thumb {
  background: #2c2825;
  border: 2px solid #1a1816;
  border-radius: 5px;
}
.timeline-viewport::-webkit-scrollbar-thumb:hover {
  background: #f0d080;
}
</style>
