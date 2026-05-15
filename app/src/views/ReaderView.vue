<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import BookReader from '../components/BookReader.vue'

const bookData = ref(null)
const index = ref(null)
const loading = ref(true)
const error = ref('')
const emit = defineEmits(['entity-select'])
const activeEntityName = ref(null)
const hoveredParagraphIdx = ref(-1)
const selectedEntity = ref(null)
const currentFile = ref('007_项羽本纪')
const showChapterList = ref(false)

async function loadIndex() {
  try {
    const res = await fetch('/data/shiji/index.json')
    if (res.ok) index.value = await res.json()
  } catch {}
}

async function loadChapter(file) {
  loading.value = true
  error.value = ''
  selectedEntity.value = null
  activeEntityName.value = null
  try {
    const res = await fetch(`/data/shiji/${file}.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    bookData.value = await res.json()
    currentFile.value = file
    showChapterList.value = false
  } catch (err) {
    error.value = '数据加载失败: ' + err.message
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadIndex()
  await loadChapter(currentFile.value)
})

const paragraphs = computed(() => bookData.value?.paragraphs ?? [])

const chaptersByType = computed(() => {
  if (!index.value) return {}
  const groups = {}
  for (const ch of index.value.chapters) {
    if (!groups[ch.type]) groups[ch.type] = []
    groups[ch.type].push(ch)
  }
  return groups
})

function onEntityClick(entity) {
  selectedEntity.value = entity
  activeEntityName.value = entity.name
  emit('entity-select', entity)
}

function clearSelection() {
  selectedEntity.value = null
  activeEntityName.value = null
}
</script>

<template>
  <div class="reader-container">
    <div class="toolbar">
      <div class="title-section">
        <h2>📖 典籍精读</h2>
        <span class="book-tag" v-if="bookData">{{ bookData.work }}</span>
        <button class="chapter-tag chapter-btn" v-if="bookData" @click="showChapterList = !showChapterList">
          {{ bookData.chapter }} ▾
        </button>
      </div>
      <div class="stats-section" v-if="bookData && index">
        <span class="stat-badge progress">{{ index.total_chapters }} 卷 · {{ index.total_paragraphs.toLocaleString() }} 段</span>
      </div>
    </div>

    <!-- 章节选择面板 -->
    <div v-if="showChapterList" class="chapter-list-overlay" @click.self="showChapterList = false">
      <div class="chapter-list-panel">
        <div class="chapter-list-header">
          <span>史记 · 一百三十卷</span>
          <button @click="showChapterList = false">✕</button>
        </div>
        <div v-for="(chapters, type) in chaptersByType" :key="type" class="chapter-group">
          <div class="chapter-group-label">{{ type }}</div>
          <div class="chapter-grid">
            <button
              v-for="ch in chapters" :key="ch.file"
              class="chapter-item"
              :class="{ active: ch.file === currentFile }"
              @click="loadChapter(ch.file)"
            >{{ ch.title }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>载入中…</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>⚠️ {{ error }}</p>
      <button @click="loadChapter(currentFile)">重试</button>
    </div>
    <div v-else class="main-body">
      <div class="reader-panel">
        <BookReader
          :title="bookData ? bookData.chapter : '正文'"
          :paragraphs="paragraphs"
          :active-entity-name="activeEntityName"
          :hovered-paragraph-idx="hoveredParagraphIdx"
          @entity-click="onEntityClick"
          @sentence-hover="idx => hoveredParagraphIdx = idx"
        />
      </div>
      <div class="entity-panel" :class="{ 'has-entity': selectedEntity }">
        <div v-if="selectedEntity" class="entity-card">
          <div class="entity-card-header">
            <span class="entity-type-badge" :style="{ background: selectedEntity.style.color }">
              {{ selectedEntity.style.label }}
            </span>
            <button class="close-btn" @click="clearSelection">✕</button>
          </div>
          <h3 class="entity-name">{{ selectedEntity.name }}</h3>
          <p v-if="selectedEntity.sub" class="entity-sub">{{ selectedEntity.sub }}</p>
          <p class="entity-content">原文：「{{ selectedEntity.content }}」</p>
          <div class="entity-placeholder">
            <p>📚 详细词条信息将在 Wiki 模块中展示</p>
          </div>
        </div>
        <div v-else class="entity-empty">
          <p>点击正文中的彩色标注查看实体详情</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reader-container { width:100%; height:100%; display:flex; flex-direction:column; background:#f5f0d6; }
.toolbar { height:56px; padding:0 24px; background:#e8e0c0; border-bottom:1px solid rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
.title-section { display:flex; align-items:center; gap:12px; }
.toolbar h2 { font-size:18px; color:#2c2825; margin:0; }
.book-tag, .chapter-tag { font-size:12px; padding:2px 10px; border-radius:4px; font-weight:bold; }
.book-tag { background:#8b4513; color:#fff; }
.chapter-tag { background:rgba(139,69,19,0.15); color:#8b4513; }
.chapter-btn { border:none; cursor:pointer; font-family:inherit; }
.chapter-btn:hover { background:rgba(139,69,19,0.25); }
.chapter-list-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.3); z-index:200; display:flex; align-items:flex-start; justify-content:center; padding-top:56px; }
.chapter-list-panel { background:#fdfaf0; width:100%; max-height:calc(100% - 56px); overflow-y:auto; box-shadow:0 4px 20px rgba(0,0,0,0.15); }
.chapter-list-header { display:flex; justify-content:space-between; align-items:center; padding:12px 20px; background:#e8e0c0; border-bottom:1px solid rgba(0,0,0,0.08); font-weight:bold; color:#2c2825; font-size:14px; position:sticky; top:0; }
.chapter-list-header button { border:none; background:none; cursor:pointer; font-size:16px; color:#8c7f55; }
.chapter-group { padding:10px 20px 6px; }
.chapter-group-label { font-size:11px; font-weight:bold; color:#8b4513; letter-spacing:0.08em; margin-bottom:6px; }
.chapter-grid { display:flex; flex-wrap:wrap; gap:4px; }
.chapter-item { font-size:12px; padding:3px 10px; border:1px solid rgba(139,69,19,0.2); border-radius:4px; background:rgba(139,69,19,0.04); color:#5d4037; cursor:pointer; font-family:inherit; transition:all 0.15s; }
.chapter-item:hover { background:rgba(139,69,19,0.12); border-color:rgba(139,69,19,0.4); }
.chapter-item.active { background:#8b4513; color:#fff; border-color:#8b4513; }
.stats-section { display:flex; gap:10px; }
.stat-badge { font-size:12px; padding:3px 10px; border-radius:12px; font-weight:600; }
.stat-badge.progress { background:rgba(0,100,140,0.1); color:#006488; }
.stat-badge.ok { background:rgba(34,120,74,0.1); color:#22784a; }
.stat-badge.fail { background:rgba(160,30,50,0.1); color:#a01e32; }
.loading-state, .error-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; color:#8c7f55; }
.spinner { width:36px; height:36px; border:3px solid rgba(139,69,19,0.2); border-top-color:#8b4513; border-radius:50%; animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.error-state button { padding:8px 20px; background:#8b4513; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:14px; }
.main-body { flex:1; display:flex; overflow:hidden; }
.reader-panel { flex:1; min-width:0; display:flex; flex-direction:column; background:#fdfaf0; }
.entity-panel { width:280px; background:#f8f4e8; border-left:1px solid rgba(0,0,0,0.06); padding:20px; overflow-y:auto; transition:width 0.2s; flex-shrink:0; }
.entity-card { background:#fff; border-radius:8px; padding:16px; box-shadow:0 1px 4px rgba(0,0,0,0.06); }
.entity-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.entity-type-badge { color:#fff; font-size:11px; padding:2px 8px; border-radius:4px; font-weight:bold; }
.close-btn { width:24px; height:24px; border:none; background:rgba(0,0,0,0.05); border-radius:50%; cursor:pointer; font-size:12px; color:#999; display:flex; align-items:center; justify-content:center; }
.close-btn:hover { background:rgba(0,0,0,0.1); }
.entity-name { font-size:20px; color:#2c2825; margin:0 0 6px 0; }
.entity-sub { font-size:13px; color:#8c7f55; margin:0 0 12px 0; }
.entity-content { font-size:14px; color:#5d544b; margin:0 0 16px 0; padding:8px 12px; background:rgba(139,69,19,0.04); border-radius:4px; line-height:1.8; }
.entity-placeholder { padding:12px; background:rgba(0,100,140,0.04); border-radius:6px; text-align:center; }
.entity-placeholder p { font-size:12px; color:#8c7f55; margin:0; }
.entity-empty { height:100%; display:flex; align-items:center; justify-content:center; }
.entity-empty p { font-size:13px; color:#bbb; text-align:center; }
</style>
