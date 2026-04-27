<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'

const router = useRouter()
const chartRef = ref(null)
const chartInstance = ref(null)
const isLoading = ref(true)
const entityCount = ref(0)
const relationCount = ref(0)

// 详情面板状态
const selectedEntity = ref(null)
const occurrences = ref([])
const fullGraphData = ref(null)
const chapterIndex = ref({})

async function initGraph() {
  try {
    // 1. 加载数据与索引
    const [graphRes, indexRes] = await Promise.all([
      fetch('/data/TOTAL_ERSHISI_CLEAN_DATA.json'),
      fetch('/data/ershisi_index.json')
    ])
    
    const rawData = await graphRes.json()
    const indexData = await indexRes.json()
    fullGraphData.value = rawData
    
    // 建立文件名到章节名的映射
    const idxMap = {}
    indexData.catalog.forEach(item => {
      idxMap[item.real_file] = item.chapter
    })
    chapterIndex.value = idxMap

    // 2. 提取高频实体并建立关系 (保持原有逻辑)
    const entityStats = new Map()
    const connections = new Map()
    
    rawData.graph.forEach(chapter => {
      const entities = [...chapter.data.persons, ...chapter.data.places]
      entities.forEach(e => {
        entityStats.set(e, (entityStats.get(e) || 0) + 1)
      })
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const pair = [entities[i], entities[j]].sort().join('|')
          connections.set(pair, (connections.get(pair) || 0) + 1)
        }
      }
    })

    const topEntities = Array.from(entityStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100) // 增加到 100 个节点
    
    const topEntitySet = new Set(topEntities.map(e => e[0]))
    
    const nodes = topEntities.map(([name, count]) => ({
      id: name,
      name: name,
      symbolSize: Math.sqrt(count) * 8 + 10,
      category: rawData.graph.some(c => c.data.persons.includes(name)) ? 0 : 1,
      value: count
    }))

    const links = []
    connections.forEach((count, pair) => {
      const [source, target] = pair.split('|')
      if (topEntitySet.has(source) && topEntitySet.has(target) && count > 1) {
        links.push({
          source,
          target,
          value: count,
          lineStyle: { width: Math.min(count, 5), opacity: 0.6 }
        })
      }
    })

    entityCount.value = nodes.length
    relationCount.value = links.length

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.dataType === 'node') {
            return `<b>实体:</b> ${params.name}<br/><b>频次:</b> ${params.value}`
          }
          return `<b>关联:</b> ${params.data.source} ↔ ${params.data.target}<br/><b>共现:</b> ${params.data.value} 次`
        }
      },
      legend: [{
        data: ['人物', '地理'],
        textStyle: { color: '#f0d080' },
        left: 20,
        top: 20
      }],
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        categories: [{ name: '人物' }, { name: '地理' }],
        roam: true,
        label: { show: true, position: 'right', color: '#f0d080', fontSize: 10 },
        force: { repulsion: 1200, edgeLength: 120, gravity: 0.1 },
        lineStyle: { color: 'rgba(240, 208, 128, 0.2)', curveness: 0.1 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 4 } }
      }]
    }

    chartInstance.value = echarts.init(chartRef.value)
    chartInstance.value.setOption(option)

    // 3. 处理点击事件：学术溯源
    chartInstance.value.on('click', (params) => {
      if (params.dataType === 'node') {
        const name = params.name
        selectedEntity.value = {
          name: name,
          type: params.data.category === 0 ? '人物' : '地理',
          count: params.value
        }
        
        // 筛选出所有出现的章节
        const found = []
        fullGraphData.value.graph.forEach(chapter => {
          if (chapter.data.persons.includes(name) || chapter.data.places.includes(name)) {
            found.push({
              fileName: chapter.file,
              title: chapterIndex.value[chapter.file] || '未命名章节'
            })
          }
        })
        occurrences.value = found
      }
    })

    isLoading.value = false
  } catch (err) {
    console.error('Failed to init graph:', err)
  }
}

function goToSource(fileName) {
  router.push({ 
    name: 'Reader', 
    query: { 
      book: 'ershisishe', 
      file: fileName,
      entity: selectedEntity.value?.name 
    } 
  })
}

onMounted(() => {
  initGraph()
  window.addEventListener('resize', () => chartInstance.value?.resize())
})

onUnmounted(() => {
  chartInstance.value?.dispose()
})
</script>

<template>
  <div class="graph-container">
    <div class="graph-header">
      <div class="stats">
        <div class="stat-item">
          <span class="val">{{ entityCount }}</span>
          <span class="lbl">核心实体</span>
        </div>
        <div class="stat-item">
          <span class="val">{{ relationCount }}</span>
          <span class="lbl">语义关联</span>
        </div>
      </div>
      <div class="title">
        <h1>🧠 史料知識圖譜</h1>
        <p>基於《二十四史》全量提取的實體關係網絡</p>
      </div>
      <div class="actions">
        <button class="action-btn">重新佈局</button>
        <button class="action-btn primary">導出數據</button>
      </div>
    </div>

    <div class="canvas-wrapper" ref="chartRef">
      <div v-if="isLoading" class="loading">正在構建知識網絡...</div>
    </div>

    <div class="detail-panel">
      <h3>📜 實體溯源</h3>
      <div v-if="selectedEntity" class="entity-info">
        <div class="info-header">
          <span class="entity-name">{{ selectedEntity.name }}</span>
          <span class="entity-type">{{ selectedEntity.type }}</span>
        </div>
        <div class="info-stats">
          出現頻次：<span class="highlight">{{ selectedEntity.count }}</span> 次
        </div>
        
        <div class="source-list-header">史料出處：</div>
        <div class="source-list">
          <div 
            v-for="source in occurrences" 
            :key="source.fileName" 
            class="source-item"
            @click="goToSource(source.fileName)"
          >
            <span class="source-icon">📖</span>
            <span class="source-title">{{ source.title }}</span>
          </div>
        </div>
      </div>
      <div v-else class="info-card">
        <p class="placeholder">點擊圖譜中的節點以查看其在《二十四史》中的原始記載...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.graph-container {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, #2c2825 0%, #1a1816 100%);
  position: relative;
  display: flex;
  flex-direction: column;
}

.graph-header {
  padding: 20px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(240, 208, 128, 0.1);
  background: rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.stats {
  display: flex;
  gap: 30px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-item .val {
  color: #f0d080;
  font-size: 24px;
  font-weight: bold;
}

.stat-item .lbl {
  color: #888;
  font-size: 12px;
  text-transform: uppercase;
}

.title h1 {
  color: #f0d080;
  font-size: 20px;
  margin: 0;
  text-align: center;
}

.title p {
  color: #666;
  font-size: 12px;
  margin: 4px 0 0 0;
}

.actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  background: transparent;
  border: 1px solid #f0d080;
  color: #f0d080;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn.primary {
  background: #f0d080;
  color: #2c2825;
}

.canvas-wrapper {
  flex: 1;
  width: 100%;
  position: relative;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #f0d080;
}

.detail-panel {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: 320px;
  max-height: 70%;
  background: rgba(26, 24, 22, 0.95);
  border: 1px solid rgba(240, 208, 128, 0.3);
  border-radius: 12px;
  padding: 20px;
  color: #ddd;
  backdrop-filter: blur(15px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  z-index: 20;
}

.detail-panel h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #f0d080;
  border-bottom: 1px solid rgba(240, 208, 128, 0.1);
  padding-bottom: 10px;
}

.entity-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.entity-name {
  font-size: 22px;
  font-weight: bold;
  color: #fff;
}

.entity-type {
  font-size: 12px;
  background: #8b4513;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
}

.info-stats {
  font-size: 14px;
  color: #aaa;
  margin-bottom: 20px;
}

.highlight {
  color: #f0d080;
  font-weight: bold;
}

.source-list-header {
  font-size: 14px;
  font-weight: bold;
  color: #f0d080;
  margin-bottom: 10px;
}

.source-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 5px;
}

.source-item {
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.source-item:hover {
  background: rgba(240, 208, 128, 0.1);
  border-color: rgba(240, 208, 128, 0.3);
  transform: translateX(5px);
}

.source-icon {
  font-size: 16px;
}

.source-title {
  font-size: 13px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-list::-webkit-scrollbar {
  width: 4px;
}
.source-list::-webkit-scrollbar-track {
  background: transparent;
}
.source-list::-webkit-scrollbar-thumb {
  background: rgba(240, 208, 128, 0.2);
  border-radius: 2px;
}

.placeholder {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
}
</style>
