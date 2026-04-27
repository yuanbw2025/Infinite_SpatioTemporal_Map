<script setup>
import { ref, onMounted, computed } from 'vue'
import { Search, BookOpen, User, MapPin } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()
const entities = ref([])
const searchQuery = ref('')
const isLoading = ref(true)

async function loadEntities() {
  try {
    const response = await fetch('/data/TOTAL_ERSHISI_CLEAN_DATA.json')
    const data = await response.json()
    
    // 统计所有实体
    const stats = new Map()
    data.graph.forEach(chapter => {
      [...chapter.data.persons, ...chapter.data.places].forEach(name => {
        if (!stats.has(name)) {
          stats.set(name, {
            name,
            count: 0,
            type: chapter.data.persons.includes(name) ? 'person' : 'place',
            chapters: new Set()
          })
        }
        const entry = stats.get(name)
        entry.count++
        entry.chapters.add(chapter.file)
      })
    })
    
    entities.value = Array.from(stats.values()).sort((a, b) => b.count - a.count)
    isLoading.value = false
  } catch (err) {
    console.error('Failed to load wiki data:', err)
  }
}

const filteredEntities = computed(() => {
  if (!searchQuery.value) return entities.value.slice(0, 50)
  return entities.value.filter(e => 
    e.name.includes(searchQuery.value)
  ).slice(0, 50)
})

function goToReader(fileName, entityName) {
  router.push({ 
    name: 'Reader', 
    query: { 
      book: 'ershisishe', 
      file: fileName,
      entity: entityName
    } 
  })
}

onMounted(loadEntities)
</script>

<template>
  <div class="wiki-view">
    <div class="wiki-header">
      <div class="search-box">
        <Search class="search-icon" :size="20" />
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="檢索二十四史人物、地理、職官..."
        />
      </div>
      <div class="wiki-stats" v-if="!isLoading">
        共收錄實體 <span class="highlight">{{ entities.length }}</span> 個
      </div>
    </div>

    <div class="wiki-grid" v-if="!isLoading">
      <div 
        v-for="entity in filteredEntities" 
        :key="entity.name" 
        class="entity-card"
      >
        <div class="card-header">
          <component 
            :is="entity.type === 'person' ? User : MapPin" 
            class="type-icon"
            :size="18"
          />
          <span class="entity-name">{{ entity.name }}</span>
          <span class="entity-count">{{ entity.count }} 次出現</span>
        </div>
        
        <div class="chapter-list">
          <div class="list-label">主要記載：</div>
          <div 
            v-for="chap in Array.from(entity.chapters).slice(0, 3)" 
            :key="chap"
            class="chapter-item"
            @click="goToReader(chap, entity.name)"
          >
            <BookOpen :size="12" />
            <span class="chap-name">{{ chap }}</span>
          </div>
          <div v-if="entity.chapters.size > 3" class="more-hint">
            等 {{ entity.chapters.size }} 個章節...
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="loading">
      正在索引全量史料數據...
    </div>
  </div>
</template>

<style scoped>
.wiki-view {
  width: 100%;
  height: 100%;
  padding: 40px;
  background: #f5f0d6;
  overflow-y: auto;
}

.wiki-header {
  margin-bottom: 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-box {
  position: relative;
  width: 400px;
}

.search-icon {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: #8c7f55;
}

.search-box input {
  width: 100%;
  padding: 12px 15px 12px 45px;
  background: #fff;
  border: 2px solid #e8e0c0;
  border-radius: 30px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.3s;
}

.search-box input:focus {
  border-color: #8b0000;
}

.wiki-stats {
  color: #5c5346;
  font-size: 14px;
}

.highlight {
  color: #8b0000;
  font-weight: bold;
  font-size: 18px;
}

.wiki-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.entity-card {
  background: #fff;
  border: 1px solid #e8e0c0;
  border-radius: 12px;
  padding: 20px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.entity-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.05);
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid #f5f0d6;
  padding-bottom: 10px;
}

.type-icon {
  margin-right: 10px;
  color: #8b0000;
}

.entity-name {
  font-size: 18px;
  font-weight: bold;
  color: #2c2825;
  flex: 1;
}

.entity-count {
  font-size: 12px;
  color: #8c7f55;
  background: #f5f0d6;
  padding: 2px 8px;
  border-radius: 10px;
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.chapter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #5c5346;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.chapter-item:hover {
  background: #f5f0d6;
  color: #8b0000;
}

.chap-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-hint {
  font-size: 11px;
  color: #aaa;
  margin-top: 5px;
  padding-left: 8px;
}

.loading {
  text-align: center;
  padding: 100px;
  color: #8c7f55;
  font-size: 18px;
}
</style>
