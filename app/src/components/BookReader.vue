<script setup>
import { computed, ref } from 'vue'

const emit = defineEmits(['entityClick', 'sentenceHover', 'scrollUpdate'])
const contentRef = ref(null)

const props = defineProps({
  title: { type: String, default: '正文' },
  paragraphs: { type: Array, default: () => [] },
  rawText: { type: String, default: '' },
  activeEntityName: { type: String, default: null },
  hoveredParagraphIdx: { type: Number, default: -1 }
})

const TAG_COLORS = {
  p:    { bg: 'rgba(139,0,0,0.08)',    border: '#8b0000', color: '#8b0000', label: '人物' },
  loc:  { bg: 'rgba(0,100,140,0.08)',  border: '#006488', color: '#006488', label: '地名' },
  geo:  { bg: 'rgba(34,120,74,0.08)',  border: '#22784a', color: '#22784a', label: '地理' },
  off:  { bg: 'rgba(120,70,20,0.08)',  border: '#784614', color: '#784614', label: '官职' },
  time: { bg: 'rgba(180,120,0,0.08)',  border: '#b47800', color: '#b47800', label: '时间' },
  evt:  { bg: 'rgba(160,30,50,0.08)',  border: '#a01e32', color: '#a01e32', label: '事件' },
  art:  { bg: 'rgba(180,150,30,0.08)', border: '#b4961e', color: '#b4961e', label: '器物' },
  ruin: { bg: 'rgba(100,80,60,0.08)',  border: '#64503c', color: '#64503c', label: '遗址' }
}

function parseAnnotatedXml(annotatedStr) {
  if (!annotatedStr) return []
  const tokens = []
  const tagRegex = /<(p|loc|geo|off|time|evt|art|ruin)(\s[^>]*)?>([^<]*)<\/\1>/g
  let lastIndex = 0
  let match
  while ((match = tagRegex.exec(annotatedStr)) !== null) {
    if (match.index > lastIndex) {
      const plain = annotatedStr.slice(lastIndex, match.index)
      if (plain) tokens.push({ type: 'text', content: plain })
    }
    const tagName = match[1]
    const attrStr = match[2] || ''
    const innerText = match[3]
    const attrs = {}
    const attrRegex = /(\w+)="([^"]*)"/g
    let attrMatch
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2]
    }
    tokens.push({
      type: tagName, content: innerText,
      name: attrs.name || innerText, sub: attrs.sub || '',
      style: TAG_COLORS[tagName] || TAG_COLORS.p
    })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < annotatedStr.length) {
    tokens.push({ type: 'text', content: annotatedStr.slice(lastIndex) })
  }
  return tokens
}

const parsedParagraphs = computed(() => {
  if (props.paragraphs.length > 0) {
    return props.paragraphs.map(para => ({
      pid: para.pid,
      tokens: parseAnnotatedXml(para.annotated || para.text),
      hasAnnotation: !!para.annotated, tamperOk: para.tamper_ok
    }))
  }
  if (props.rawText) {
    const lines = props.rawText.split('\n').filter(l => l.trim())
    return lines.map((line, idx) => ({
      pid: `${idx + 1}`, tokens: [{ type: 'text', content: line }],
      hasAnnotation: false, tamperOk: true
    }))
  }
  return []
})

function handleEntityClick(token) {
  if (token.type !== 'text') {
    emit('entityClick', { type: token.type, name: token.name, sub: token.sub, content: token.content, style: token.style })
  }
}

function handleScroll(e) {
  const el = e.target
  const pct = el.scrollTop / (el.scrollHeight - el.clientHeight || 1)
  emit('scrollUpdate', pct)
}

function setScrollPercentage(pct) {
  if (contentRef.value) {
    contentRef.value.scrollTop = pct * (contentRef.value.scrollHeight - contentRef.value.clientHeight)
  }
}

defineExpose({ setScrollPercentage })
</script>

<template>
  <div class="book-reader">
    <div class="reader-header" v-if="title">
      <span class="header-icon">📜</span>
      <h2>{{ title }}</h2>
    </div>
    <div class="reader-content-body" ref="contentRef" @scroll="handleScroll">
      <div v-for="(para, pIdx) in parsedParagraphs" :key="para.pid" class="paragraph-block"
        :class="{ 'hovered': pIdx === hoveredParagraphIdx }"
        @mouseenter="emit('sentenceHover', pIdx)" @mouseleave="emit('sentenceHover', -1)">
        <span class="para-number">{{ para.pid }}</span>
        <span class="para-body">
          <template v-for="(token, tIdx) in para.tokens" :key="tIdx">
            <span v-if="token.type === 'text'" class="text-part">{{ token.content }}</span>
            <span v-else class="entity-tag" :class="['tag-' + token.type, { 'active': activeEntityName && activeEntityName === token.name }]"
              :style="{ '--tag-bg': token.style.bg, '--tag-border': token.style.border, '--tag-color': token.style.color }"
              :title="'[' + token.style.label + '] ' + token.name + (token.sub ? ' · ' + token.sub : '')"
              @click="handleEntityClick(token)">{{ token.content }}</span>
          </template>
        </span>
      </div>
      <div v-if="parsedParagraphs.length === 0" class="empty-hint">暂无内容</div>
    </div>
    <div class="legend-bar">
      <span v-for="(style, tag) in TAG_COLORS" :key="tag" class="legend-item">
        <span class="legend-dot" :style="{ background: style.color }"></span>
        <span :style="{ color: style.color }">{{ style.label }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.book-reader { width:100%; height:100%; display:flex; flex-direction:column; }
.reader-header { padding:16px 24px; border-bottom:1px solid rgba(0,0,0,0.08); background:#f0ead2; display:flex; align-items:center; gap:8px; }
.reader-header h2 { font-size:16px; color:#2c2825; margin:0; }
.reader-content-body { flex:1; padding:28px 36px; line-height:2.4; overflow-y:auto; font-size:18px; color:#2c2825; text-align:justify; }
.paragraph-block { margin-bottom:20px; padding:8px 12px 8px 28px; border-radius:6px; transition:background-color 0.2s; position:relative; }
.paragraph-block.hovered { background-color:rgba(139,69,19,0.04); }
.para-number { position:absolute; left:2px; top:10px; font-size:10px; color:#bbb; font-family:monospace; user-select:none; }
.para-body { display:inline; }
.text-part { color:inherit; }
.entity-tag { display:inline; color:var(--tag-color); background:var(--tag-bg); border-bottom:2px solid var(--tag-border); cursor:pointer; transition:all 0.15s ease; padding:0 1px; border-radius:2px; font-weight:500; }
.entity-tag:hover { filter:brightness(0.85); background:var(--tag-bg); }
.entity-tag.active { font-weight:700; border-bottom-width:3px; }
.tag-p { font-weight:600; }
.tag-time { border-bottom-style:dashed; }
.tag-evt { border-bottom-style:double; border-bottom-width:3px; }
.tag-off { font-size:0.95em; }
.legend-bar { display:flex; gap:16px; padding:8px 24px; border-top:1px solid rgba(0,0,0,0.06); background:#f8f4e8; flex-wrap:wrap; }
.legend-item { display:flex; align-items:center; gap:4px; font-size:11px; opacity:0.7; }
.legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.empty-hint { text-align:center; padding:60px; color:#aaa; font-size:16px; }
</style>
