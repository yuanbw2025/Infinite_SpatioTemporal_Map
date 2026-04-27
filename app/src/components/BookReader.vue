<script setup>
import { computed, ref } from 'vue'

const emit = defineEmits(['entityClick', 'sentenceHover', 'scrollUpdate'])

const contentRef = ref(null)

const props = defineProps({
  title: {
    type: String,
    default: '正文'
  },
  rawText: {
    type: String,
    required: true
  },
  activeEntityName: {
    type: String,
    default: null
  },
  hoveredSentenceIdx: {
    type: Number,
    default: -1
  }
})

// 按句号拆分文本，并处理动态高亮
const parsedSentences = computed(() => {
  if (!props.rawText) return []
  
  // 先按换行符和句末标点拆分
  const lines = props.rawText.split('\n')
  const sentences = []
  
  lines.forEach(line => {
    if (!line.trim()) return
    
    // 粗略拆分句子
    const parts = line.split(/(?<=[。！？])/)
    parts.forEach(part => {
      if (!part.trim()) return
      
      const sentenceData = []
      if (props.activeEntityName && part.includes(props.activeEntityName)) {
        // 动态切割出实体高亮
        const subParts = part.split(props.activeEntityName)
        subParts.forEach((sub, idx) => {
          if (sub) sentenceData.push({ type: 'text', content: sub })
          if (idx < subParts.length - 1) {
            sentenceData.push({ 
              type: 'entity', 
              content: props.activeEntityName, 
              cssClass: 'entity-highlight' 
            })
          }
        })
      } else {
        sentenceData.push({ type: 'text', content: part })
      }
      sentences.push(sentenceData)
    })
  })
  
  return sentences
})

function handleSentenceEnter(idx) {
  emit('sentenceHover', idx)
}

function handleSentenceLeave() {
  emit('sentenceHover', -1)
}

function handleScroll(e) {
  const el = e.target
  const percentage = el.scrollTop / (el.scrollHeight - el.clientHeight || 1)
  emit('scrollUpdate', percentage)
}

function setScrollPercentage(percentage) {
  if (contentRef.value) {
    const el = contentRef.value
    el.scrollTop = percentage * (el.scrollHeight - el.clientHeight)
  }
}

defineExpose({
  setScrollPercentage
})
</script>

<template>
  <div class="book-reader">
    <div class="reader-header">
      <span class="header-icon">📜</span>
      <h2>{{ title }}</h2>
    </div>
    <div class="reader-content-body" ref="contentRef" @scroll="handleScroll">
      <div 
        v-for="(sentence, sIdx) in parsedSentences" 
        :key="sIdx" 
        class="sentence-row"
        :class="{ 'hovered': sIdx === hoveredSentenceIdx }"
        @mouseenter="emit('sentenceHover', sIdx)"
        @mouseleave="emit('sentenceHover', -1)"
      >
        <template v-for="(part, pIdx) in sentence" :key="pIdx">
          <span 
            v-if="part.type === 'entity'" 
            class="entity" 
            :class="[part.cssClass, { 'active': activeEntityName === part.content }]"
          >
            {{ part.content }}
          </span>
          <span v-else class="text-part">{{ part.content }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-reader {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.reader-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.reader-header h2 {
  font-size: 18px;
  color: #2c2825;
  margin: 0;
}

.reader-content-body {
  width: 100%;
  padding: 24px;
  line-height: 2.2;
  transition: background-color 0.2s, box-shadow 0.2s;
  border-radius: 4px;
  padding: 2px 0;
}

.sentence-block.is-hovered {
  background-color: rgba(139, 0, 0, 0.08); /* 淡淡的朱砂红底色 */
  box-shadow: 0 0 0 2px rgba(139, 0, 0, 0.08);
}

.plain-text {
  color: #4a4238;
}

.entity {
  display: inline-block;
  margin: 0 2px;
  padding: 0 4px;
  border-radius: 4px;
  cursor: default;
  transition: all 0.2s;
  box-decoration-break: clone;
}

.entity-person {
  background: rgba(201, 55, 86, 0.1);
  color: #c93756;
  border-bottom: 1px solid rgba(201, 55, 86, 0.5);
  cursor: pointer;
}

.entity-person:hover, .entity-person.is-active {
  background: rgba(201, 55, 86, 0.3);
  color: #8b0000;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(201, 55, 86, 0.2);
}

.entity-location {
  color: #005b9f;
  border-bottom: 1px dashed rgba(0, 91, 159, 0.5);
}

.entity-position {
  color: #8a6a1c;
}

.entity-time {
  color: #007356;
}

/* Custom Scrollbar for Reader */
.reader-content::-webkit-scrollbar {
  width: 6px;
}
.reader-content::-webkit-scrollbar-track {
  background: transparent;
}
.reader-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}
</style>
