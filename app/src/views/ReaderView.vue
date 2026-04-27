<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import BookReader from '../components/BookReader.vue'

const route = useRoute()

const traditionalText = ref('')
const simplifiedText = ref('')
const photocopyUrl = ref('')
const chapters = ref([])
const selectedChapterIndex = ref(0)

const hoveredSentenceIdx = ref(-1)

async function loadData() {
  const bookId = route.query.book
  const targetFile = route.query.file
  
  if (bookId === 'ershisishe') {
    try {
      const response = await fetch('/data/ershisi_index.json')
      const indexData = await response.json()
      chapters.value = indexData.catalog
      
      if (chapters.value.length > 0) {
        // 如果 URL 指定了文件名，则跳转到该章，否则默认加载第 0 章
        let targetIdx = 0
        if (targetFile) {
          const found = chapters.value.findIndex(ch => ch.real_file === targetFile)
          if (found !== -1) targetIdx = found
        }
        await loadChapter(targetIdx)
      }
    } catch (err) {
      console.error('Failed to load ershisi index:', err)
    }
  } else {
    traditionalText.value = "【系統提示：正向數據庫請求該典籍之全量原文...】"
    simplifiedText.value = "【系統提示：正向數據庫請求該典籍之全量譯文...】"
    photocopyUrl.value = ''
    chapters.value = []
  }
}

async function loadChapter(index) {
  selectedChapterIndex.value = index
  const chapter = chapters.value[index]
  const fileName = chapter.real_file
  
  try {
    // 同时发起两个请求，分别获取原文和译文
    const [tradRes, simpRes] = await Promise.all([
      fetch(`/data/ershisi_trad/${fileName}`),
      fetch(`/data/ershisi_simp/${fileName}`)
    ])
    
    if (tradRes.ok) traditionalText.value = await tradRes.text()
    if (simpRes.ok) simplifiedText.value = await simpRes.text()
    else simplifiedText.value = "【系統提示：該章節暫無白話譯文數據】"
    
  } catch (err) {
    console.error('Failed to load chapter text split:', err)
  }
}

onMounted(loadData)
watch(() => route.query.book, loadData)

const showPhotocopy = ref(true)

function onSentenceHover(idx) {
  hoveredSentenceIdx.value = idx
}

// Sync Scroll Logic
const photocopyContainerRef = ref(null)
const tradReaderRef = ref(null)
const simpReaderRef = ref(null)
let isSyncing = false

function handleReaderScroll(percentage, source) {
  if (isSyncing) return
  isSyncing = true
  
  requestAnimationFrame(() => {
    if (source === 'trad') {
      if (simpReaderRef.value) simpReaderRef.value.scrollTop = (simpReaderRef.value.scrollHeight - simpReaderRef.value.clientHeight) * percentage
      if (photocopyContainerRef.value) photocopyContainerRef.value.scrollTop = (photocopyContainerRef.value.scrollHeight - photocopyContainerRef.value.clientHeight) * percentage
    } else if (source === 'simp') {
      if (tradReaderRef.value) tradReaderRef.value.scrollTop = (tradReaderRef.value.scrollHeight - tradReaderRef.value.clientHeight) * percentage
      if (photocopyContainerRef.value) photocopyContainerRef.value.scrollTop = (photocopyContainerRef.value.scrollHeight - photocopyContainerRef.value.clientHeight) * percentage
    }
    isSyncing = false
  })
}

// Zoom & Drag Logic
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const lastMousePos = ref({ x: 0, y: 0 })

function handleWheel(e) {
  e.preventDefault()
  if (e.ctrlKey) {
    // Pinch to zoom (Mac Trackpad)
    const delta = e.deltaY > 0 ? 0.95 : 1.05
    const newScale = scale.value * delta
    if (newScale > 0.2 && newScale < 10) {
      scale.value = newScale
    }
  } else {
    // Two-finger pan (Mac Trackpad)
    translateX.value -= e.deltaX
    translateY.value -= e.deltaY
  }
}

function startDrag(e) {
  isDragging.value = true
  lastMousePos.value = { x: e.clientX, y: e.clientY }
}

function onDrag(e) {
  if (!isDragging.value) return
  const dx = e.clientX - lastMousePos.value.x
  const dy = e.clientY - lastMousePos.value.y
  translateX.value += dx
  translateY.value += dy
  lastMousePos.value = { x: e.clientX, y: e.clientY }
}

function stopDrag() {
  isDragging.value = false
}

function resetZoom() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

function syncScroll(sourceEl, sourceName) {
  const percentage = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1)
  handleReaderScroll(percentage, sourceName)
}
</script>

<template>
  <div class="reader-container">
    <div class="toolbar">
      <div class="title-section">
        <h2>📖 典籍精读</h2>
        <span class="book-tag" v-if="route.query.book === 'ershisishe'">全量正史數據庫</span>
      </div>
      <div class="controls">
        <div class="chapter-selector" v-if="chapters.length > 0">
          <span class="label">卷冊導航：</span>
          <select v-model="selectedChapterIndex" @change="loadChapter(selectedChapterIndex)">
            <option v-for="(ch, index) in chapters" :key="index" :value="index">
              第 {{ index + 1 }} 卷 - {{ ch.chapter }} ({{ ch.source.split('/').pop() }})
            </option>
          </select>
        </div>
        <label class="toggle-label"><input type="checkbox" v-model="showPhotocopy" /> 顯示影印本</label>
      </div>
    </div>

    <div class="columns-wrapper">
      <!-- 影印本列 -->
      <div class="column photocopy-col" v-if="showPhotocopy">
        <div class="col-header">
          影印本 (原貌)
          <button class="reset-btn" @click="resetZoom">重置视图</button>
        </div>
        <div 
          class="col-content photocopy-content" 
          ref="photocopyContainerRef" 
          @scroll="handlePhotocopyScroll"
          @wheel="handleWheel"
          @mousedown="startDrag"
          @mousemove="onDrag"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
        >
          <img 
            v-if="photocopyUrl" 
            :src="photocopyUrl" 
            class="photocopy-img" 
            alt="影印本" 
            :style="{ transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)` }"
          />
          <div v-else class="photocopy-placeholder">
            <p>此处展示古籍扫描件原图</p>
          </div>
        </div>
      </div>

      <!-- 繁体原貌列 -->
      <div class="column">
        <div class="col-header">繁体原貌 (深度标注)</div>
        <div 
          class="col-content" 
          ref="tradReaderRef" 
          @scroll="e => handleReaderScroll(e.target.scrollTop / (e.target.scrollHeight - e.target.clientHeight || 1), 'trad')"
        >
          <BookReader 
            :raw-text="traditionalText" 
            :active-entity-name="route.query.entity"
            :hovered-sentence-idx="hoveredSentenceIdx"
            @sentence-hover="onSentenceHover"
          />
        </div>
      </div>

      <!-- 简体白话列 -->
      <div class="column">
        <div class="col-header">简体白话</div>
        <div 
          class="col-content" 
          ref="simpReaderRef" 
          @scroll="e => handleReaderScroll(e.target.scrollTop / (e.target.scrollHeight - e.target.clientHeight || 1), 'simp')"
        >
          <BookReader 
            :raw-text="simplifiedText" 
            :active-entity-name="route.query.entity"
            :hovered-sentence-idx="hoveredSentenceIdx"
            @sentence-hover="onSentenceHover"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reader-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f0d6;
}

.toolbar {
  height: 60px;
  padding: 0 30px;
  background: #e8e0c0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.toolbar h2 {
  font-size: 20px;
  color: #2c2825;
  margin: 0;
}

.book-tag {
  background: #8b4513;
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
}

.controls {
  display: flex;
  align-items: center;
  gap: 25px;
}

.chapter-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chapter-selector .label {
  font-weight: bold;
  font-size: 14px;
  color: #5d544b;
}

.chapter-selector select {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #c9bfa4;
  background: #fdfaf0;
  font-family: inherit;
  font-size: 14px;
  color: #2c2825;
  cursor: pointer;
  outline: none;
  min-width: 280px;
}

.chapter-selector select:focus {
  border-color: #8b4513;
  box-shadow: 0 0 0 2px rgba(139, 69, 19, 0.1);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #4a4238;
  cursor: pointer;
}

.columns-wrapper {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: #fdfaf0;
}

.column {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  min-width: 0; /* 防止内容撑破布局 */
}

.column:last-child {
  border-right: none;
}

.col-header {
  height: 40px;
  background: #f0ead2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  color: #5d544b;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.col-content {
  flex: 1;
  overflow-y: auto !important; /* 强制开启纵向滚动 */
  padding: 20px;
  position: relative;
  display: flex;
  flex-direction: column;
}

.photocopy-content {
  background: #e3d9b1;
  overflow: hidden; /* 防止内部滚动条干扰拖拽 */
  text-align: center;
  cursor: grab;
}

.photocopy-content:active {
  cursor: grabbing;
}

.photocopy-img {
  width: 100%;
  height: auto;
  display: block;
  transform-origin: center center;
  transition: transform 0.05s linear;
}

.reset-btn {
  margin-left: 10px;
  font-size: 10px;
  padding: 2px 6px;
  background: #c93756;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.photocopy-placeholder {
  margin: 40px auto;
  border: 2px dashed #c0b386;
  padding: 40px;
  color: #8c7f55;
  border-radius: 8px;
  width: 80%;
}

/* 覆盖 BookReader 内部的默认 header 样式，因为我们在外层有 col-header 了 */
:deep(.reader-header) {
  display: none;
}
</style>
