<script setup>
import { ref, onMounted, computed } from 'vue'
import BookReader from '../components/BookReader.vue'

const bookData = ref(null)
const loading = ref(true)
const error = ref('')
const activeEntityName = ref(null)
const hoveredParagraphIdx = ref(-1)
const selectedEntity = ref(null)

async function loadXiangyuData() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/data/xiangyu_annotated.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    bookData.value = await res.json()
  } catch (err) {
    console.error('加载项羽本纪数据失败:', err)
    error.value = '数据加载失败: ' + err.message
  } finally {
    loading.value = false
  }
}

onMounted(loadXiangyuData)

const paragraphs = computed(() => {
  if (!bookData.value || !bookData.value.paragraphs) return []
  return bookData.value.paragraphs
})

const progressText = computed(() => {
  if (!bookData.value) return ''
  const done = bookData.value.paragraph_count_done || 0
  const total = bookData.value.paragraph_count_total || 0
  return `${done}/${total} 段已标注`
})

const tamperStats = computed(() => {
  if (!paragraphs.value.length) return { ok: 0, fail: 0 }
  const ok = paragraphs.value.filter(p => p.tamper_ok === true).length
  const fail = paragraphs.value.filter(p => p.tamper_ok === false).length
  return { ok, fail }
})

function onEntityClick(entity) {
  selectedEntity.value = entity
  activeEntityName.value = entity.name
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
        <span class="chapter-tag" v-if="bookData">{{ bookData.chapter }}</span>
      </div>
      <div class="stats-section" v-if="bookData">
        <span class="stat-badge progress">{{ progressText }}</span>
        <span class="stat-badge ok">✓ {{ tamperStats.ok }} 通过</span>
        <span class="stat-badge fail" v-if="tamperStats.fail > 0">✗ {{ tamperStats.fail }} 异常</span>
      </div>
    </div>
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>正在载入《史记·项羽本纪》标注数据…</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>⚠️ {{ error }}</p>
      <button @click="loadXiangyuData">重试</button>
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
          <p>👈 点击正文中的彩色标注查看实体详情</p>
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
