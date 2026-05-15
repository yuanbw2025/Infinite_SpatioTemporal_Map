<script setup>
import { ref } from 'vue'
import MapView from './MapView.vue'
import ReaderView from './ReaderView.vue'

const splitRatio = ref(50)
const activeEntity = ref(null)
const mapFocusName = ref(null)

function handleMapClick(entity) {
  activeEntity.value = entity
}

function handleReaderClick(entity) {
  activeEntity.value = entity
  // 地名/地理实体 → 驱动地图飞到对应位置
  if (entity.type === 'loc' || entity.type === 'geo') {
    mapFocusName.value = entity.name
  }
}
</script>

<template>
  <div class="unified-view">
    <!-- Main Content Split -->
    <div class="split-container" :style="{ gridTemplateColumns: `${splitRatio}% 1fr` }">
      <!-- Map Section -->
      <section class="section-map">
        <MapView
          class="integrated-map"
          :focus-name="mapFocusName"
          @entity-select="handleMapClick"
        />
      </section>

      <!-- Reader Section -->
      <section class="section-reader">
        <div class="reader-header-minimal">
          <div class="seal-logo">
            <div class="seal-box">史</div>
          </div>
          <h2 class="font-scholar">正史卷冊精讀</h2>
        </div>
        <ReaderView 
          class="integrated-reader"
          @entity-select="handleReaderClick"
        />
      </section>
    </div>

    <!-- Layout Controls (Minimal HUD) -->
    <div class="layout-controls">
      <button @click="splitRatio = 30" :class="{ active: splitRatio === 30 }">読</button>
      <button @click="splitRatio = 50" :class="{ active: splitRatio === 50 }">均</button>
      <button @click="splitRatio = 70" :class="{ active: splitRatio === 70 }">図</button>
    </div>
  </div>
</template>

<style scoped>
.unified-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-parchment-base);
  position: relative;
}

.split-container {
  display: grid;
  width: 100%;
  height: 100%;
  transition: grid-template-columns 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.section-map {
  position: relative;
  border-right: 2px solid var(--color-ink-deep);
  overflow: hidden;
  min-width: 300px;
  background: #aad3df; /* 地图底色，防止白屏 */
}

.section-reader {
  display: flex;
  flex-direction: column;
  background: var(--color-parchment-light);
  overflow: hidden;
}

.reader-header-minimal {
  padding: 12px 24px;
  background: var(--color-parchment-dark);
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: var(--border-ink);
}

.seal-box {
  width: 32px;
  height: 32px;
  background: var(--color-cinnabar);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-scholar);
  font-weight: bold;
  font-size: 18px;
  border-radius: 4px;
}

.integrated-reader {
  flex: 1;
}

/* Override ReaderView styles for integration */
:deep(.reader-container .toolbar) {
  display: none; /* Hide the internal toolbar as we have a unified one or integrated controls */
}

.layout-controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1px;
  background: var(--color-ink-deep);
  padding: 2px;
  border-radius: 4px;
  box-shadow: var(--shadow-premium);
  z-index: 1000;
  opacity: 0.3;
  transition: opacity 0.3s;
}

.layout-controls:hover {
  opacity: 1;
}

.layout-controls button {
  background: var(--color-parchment-light);
  border: none;
  padding: 4px 12px;
  font-family: var(--font-scholar);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.layout-controls button:hover {
  background: var(--color-parchment-dark);
}

.layout-controls button.active {
  background: var(--color-cinnabar);
  color: white;
}
</style>
