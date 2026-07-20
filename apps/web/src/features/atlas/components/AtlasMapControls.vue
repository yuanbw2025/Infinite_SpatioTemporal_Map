<script setup lang="ts">
import type { HistoricalMapResource } from "@infinite-spacetime/contracts";
import type { TimeResolution } from "../atlas-time";

defineProps<{
  currentTimeLabel: string;
  sliderMin: number | undefined;
  sliderMax: number | undefined;
  playing: boolean;
  mapResources: readonly HistoricalMapResource[];
}>();
const emit = defineEmits<{
  resolutionChange: [];
  tickChange: [];
  togglePlayback: [];
}>();
const currentTick = defineModel<number | undefined>("currentTick");
const timeResolution = defineModel<TimeResolution>("timeResolution", {
  required: true,
});
const playbackStep = defineModel<number>("playbackStep", { required: true });
const showPoints = defineModel<boolean>("showPoints", { required: true });
const showRegions = defineModel<boolean>("showRegions", { required: true });
const showRoutes = defineModel<boolean>("showRoutes", { required: true });
const showLabels = defineModel<boolean>("showLabels", { required: true });
const resourceVisibility = defineModel<Record<string, boolean>>(
  "resourceVisibility",
  { required: true },
);
const resourceOpacity = defineModel<Record<string, number>>("resourceOpacity", {
  required: true,
});
</script>

<template>
  <div class="timeline-control">
    <div class="timeline-readout">
      <span>时间轴</span><strong>{{ currentTimeLabel }}</strong>
    </div>
    <label class="timeline-resolution">
      <span>播放粒度</span>
      <select v-model="timeResolution" @change="emit('resolutionChange')">
        <option value="year">按年</option>
        <option value="month">按月</option>
        <option value="day">按日</option>
      </select>
    </label>
    <input
      v-if="sliderMin !== undefined && sliderMax !== undefined"
      v-model.number="currentTick"
      class="timeline-slider"
      type="range"
      :min="sliderMin"
      :max="sliderMax"
      :step="Math.max(1, playbackStep)"
      @change="emit('tickChange')"
    />
    <label class="timeline-step">
      <span
        >步长（{{
          timeResolution === "day"
            ? "日"
            : timeResolution === "month"
              ? "月"
              : "年"
        }}）</span
      >
      <input v-model.number="playbackStep" type="number" min="1" />
    </label>
    <button class="timeline-play" type="button" @click="emit('togglePlayback')">
      {{ playing ? "暂停" : "播放时代变化" }}
    </button>
  </div>

  <div class="map-layer-controls" role="group" aria-label="地图图层">
    <label><input v-model="showPoints" type="checkbox" /> 点位与聚合</label>
    <label><input v-model="showRegions" type="checkbox" /> 历史区域</label>
    <label><input v-model="showRoutes" type="checkbox" /> 人物行迹</label>
    <label><input v-model="showLabels" type="checkbox" /> 地名标注</label>
  </div>

  <section v-if="mapResources.length" class="reference-layer-controls">
    <header>
      <strong>历代底图与疆域投影</strong>
      <span>资源随时间轴筛选，并绑定当前发布包版本</span>
    </header>
    <label v-for="resource in mapResources" :key="resource.id">
      <input v-model="resourceVisibility[resource.id]" type="checkbox" />
      <span>{{ resource.title }}</span>
      <small>{{
        resource.kind === "raster_map" ? "历史地图" : "疆域投影"
      }}</small>
      <input
        v-model.number="resourceOpacity[resource.id]"
        type="range"
        min="0"
        max="1"
        step="0.05"
        :aria-label="`${resource.title}透明度`"
      />
    </label>
  </section>
</template>
