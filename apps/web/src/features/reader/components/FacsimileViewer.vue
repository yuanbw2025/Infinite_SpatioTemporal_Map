<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  imageUrl: string | undefined;
  canvasUrl: string | undefined;
  pageLabel: string;
  region: readonly [number, number, number, number] | undefined;
  width: number | undefined;
  height: number | undefined;
}>();

const zoom = ref(1);
const offset = ref({ x: 0, y: 0 });
const dragging = ref(false);
let dragStart = { x: 0, y: 0 };
let offsetStart = { x: 0, y: 0 };

const transform = computed(
  () =>
    `translate(${offset.value.x}px, ${offset.value.y}px) scale(${zoom.value})`,
);
const regionStyle = computed(() => {
  if (!props.region || !props.width || !props.height) return undefined;
  const [x, y, width, height] = props.region;
  return {
    left: `${(x / props.width) * 100}%`,
    top: `${(y / props.height) * 100}%`,
    width: `${(width / props.width) * 100}%`,
    height: `${(height / props.height) * 100}%`,
  };
});

function setZoom(value: number) {
  zoom.value = Math.min(Math.max(value, 0.5), 5);
}

function reset() {
  zoom.value = 1;
  offset.value = { x: 0, y: 0 };
}

function startDrag(event: PointerEvent) {
  if (!props.imageUrl || event.button !== 0) return;
  dragging.value = true;
  dragStart = { x: event.clientX, y: event.clientY };
  offsetStart = { ...offset.value };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function drag(event: PointerEvent) {
  if (!dragging.value) return;
  offset.value = {
    x: offsetStart.x + event.clientX - dragStart.x,
    y: offsetStart.y + event.clientY - dragStart.y,
  };
}

function endDrag() {
  dragging.value = false;
}

function wheelZoom(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  setZoom(zoom.value + (event.deltaY < 0 ? 0.15 : -0.15));
}
</script>

<template>
  <section class="facsimile-viewer">
    <header>
      <strong>{{ pageLabel }}</strong>
      <div v-if="imageUrl" class="facsimile-tools">
        <button
          type="button"
          aria-label="缩小影印页"
          @click="setZoom(zoom - 0.25)"
        >
          −
        </button>
        <span>{{ Math.round(zoom * 100) }}%</span>
        <button
          type="button"
          aria-label="放大影印页"
          @click="setZoom(zoom + 0.25)"
        >
          ＋
        </button>
        <button type="button" @click="reset">复位</button>
      </div>
    </header>
    <div
      v-if="imageUrl"
      class="facsimile-stage"
      :class="{ 'facsimile-stage--dragging': dragging }"
      @pointerdown="startDrag"
      @pointermove="drag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @wheel="wheelZoom"
    >
      <div class="facsimile-content" :style="{ transform }">
        <img :src="imageUrl" alt="方志影印页" draggable="false" />
        <i
          v-if="regionStyle"
          class="facsimile-region"
          :style="regionStyle"
          aria-label="本段原文在影印页中的位置"
        ></i>
      </div>
    </div>
    <a
      v-else-if="canvasUrl"
      class="button-link"
      :href="canvasUrl"
      target="_blank"
      rel="noreferrer"
      >打开 IIIF 影印画布</a
    >
    <p v-else class="muted">这一段尚未挂接影印页。</p>
  </section>
</template>

<style scoped>
.facsimile-viewer {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.facsimile-viewer > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.facsimile-tools {
  display: flex;
  align-items: center;
  gap: 5px;
}
.facsimile-tools button {
  min-width: 30px;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--paper-strong);
  cursor: pointer;
}
.facsimile-tools span {
  min-width: 44px;
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}
.facsimile-stage {
  min-height: 520px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #cec7b7;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.facsimile-stage--dragging {
  cursor: grabbing;
}
.facsimile-content {
  position: relative;
  width: max-content;
  max-width: 100%;
  margin: 0 auto;
  transform-origin: 50% 50%;
  transition: transform 80ms ease-out;
}
.facsimile-content img {
  display: block;
  max-width: 100%;
  pointer-events: none;
}
.facsimile-region {
  position: absolute;
  border: 2px solid #f4b642;
  background: rgba(244, 182, 66, 0.2);
  box-shadow: 0 0 0 2px rgba(36, 34, 29, 0.35);
  pointer-events: none;
}
</style>
