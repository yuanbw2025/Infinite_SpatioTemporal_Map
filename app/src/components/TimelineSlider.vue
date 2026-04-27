<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentDate: {
    type: Number,
    required: true
  },
  showAll: {
    type: Boolean,
    required: true
  },
  activeEntity: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:currentDate', 'update:showAll'])

const isMicroMode = computed(() => {
  return props.activeEntity && props.activeEntity.events && props.activeEntity.events.length > 0;
})

const sliderMin = computed(() => {
  if (isMicroMode.value) {
    return props.activeEntity.events[0].year;
  }
  return -200;
})

const sliderMax = computed(() => {
  if (isMicroMode.value) {
    const events = props.activeEntity.events;
    return events[events.length - 1].year + 1; // plus 1 to show the last year completely
  }
  return 1700;
})

const sliderStep = computed(() => {
  return isMicroMode.value ? 0.083333 : 1; // 1/12 for month level
})

function onInput(e) {
  emit('update:currentDate', parseFloat(e.target.value))
}

function toggleShowAll() {
  emit('update:showAll', !props.showAll)
}

const displayYear = computed(() => Math.floor(props.currentDate))
const displayMonth = computed(() => {
  if (!isMicroMode.value) return null;
  return Math.round((props.currentDate % 1) * 12) + 1;
})
</script>

<template>
  <div class="timeline-panel">
    <div class="year-display">
      <span class="year-num" v-if="!showAll">{{ displayYear }}</span>
      <span class="year-num" v-else>全部</span>
      <span class="year-label" v-if="!showAll">年 (公元)</span>
      
      <span class="month-num" v-if="!showAll && isMicroMode">{{ displayMonth }}</span>
      <span class="year-label" v-if="!showAll && isMicroMode">月</span>

      <button class="show-all-btn" @click="toggleShowAll">
        {{ showAll ? '🕐 啟用時間過濾' : '📋 顯示全部' }}
      </button>
    </div>
    
    <input
      type="range"
      :min="sliderMin"
      :max="sliderMax"
      :step="sliderStep"
      :value="currentDate"
      @input="onInput"
      class="time-slider"
      :class="{ dimmed: showAll }"
    />
    
    <div class="slider-labels" v-if="!isMicroMode">
      <span>前200 (漢)</span>
      <span>500 (南北朝)</span>
      <span>1000 (宋)</span>
      <span>1700 (清)</span>
    </div>
    <div class="slider-labels micro-labels" v-else>
      <span>{{ sliderMin }} 年</span>
      <span>{{ activeEntity?.name }}的流转岁月</span>
      <span>{{ sliderMax - 1 }} 年</span>
    </div>
  </div>
</template>

<style scoped>
.timeline-panel {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  max-width: 80vw;
  background: rgba(15, 15, 25, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px 24px;
  z-index: 10;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.year-display {
  text-align: center;
  margin-bottom: 12px;
}

.year-num, .month-num {
  font-size: 32px;
  font-weight: 700;
  color: #f0d080;
  font-family: 'Georgia', serif;
}

.month-num {
  margin-left: 15px;
  color: #50b4ff;
}

.year-label {
  font-size: 12px;
  color: #888;
  margin-left: 6px;
}

.time-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(to right, #ff5050, #b464ff, #00c896, #ff7832, #ffb400, #50b4ff, #dc3232);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.time-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #f0d080;
  border: 2px solid #fff;
  box-shadow: 0 0 10px rgba(240,208,128,0.5);
  cursor: grab;
}

.time-slider::-webkit-slider-thumb:active {
  cursor: grabbing;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #888;
  margin-top: 8px;
}

.micro-labels span {
  color: #50b4ff;
  font-weight: bold;
}

.show-all-btn {
  margin-left: 12px;
  padding: 3px 10px;
  font-size: 11px;
  background: rgba(240, 208, 128, 0.15);
  border: 1px solid rgba(240, 208, 128, 0.3);
  border-radius: 4px;
  color: #f0d080;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.show-all-btn:hover {
  background: rgba(240, 208, 128, 0.25);
}

.time-slider.dimmed {
  opacity: 0.3;
  pointer-events: none;
}
</style>
