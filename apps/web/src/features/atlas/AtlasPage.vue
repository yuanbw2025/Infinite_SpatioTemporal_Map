<script setup lang="ts">
import type {
  EntityType,
  EntityId,
  HistoricalMapResource,
  MapObservation,
} from "@infinite-spacetime/contracts";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/use-application";
import {
  buildTemporalQuery,
  civilFromDay,
  rangeTick,
  temporalSortValue,
  yearMonthFromTick,
  type TimeResolution,
} from "./atlas-time";
import HistoricalMap from "./components/HistoricalMap.vue";
import AtlasMapControls from "./components/AtlasMapControls.vue";

const runtime = useApplication();
const { services } = runtime;
const route = useRoute();
const observations = ref<readonly MapObservation[]>([]);
const journeyObservations = ref<readonly MapObservation[]>([]);
const activeTypes = ref<EntityType[]>([
  "place",
  "person",
  "event",
  "site",
  "artifact",
]);
const startYear = ref<number>();
const endYear = ref<number>();
const selected = ref<MapObservation>();
const loading = ref(false);
const error = ref("");
const nextCursor = ref<string>();
const currentTick = ref<number>();
const timeResolution = ref<TimeResolution>("year");
const playbackStep = ref(1);
const playing = ref(false);
const showPoints = ref(true);
const showRegions = ref(true);
const showRoutes = ref(true);
const showLabels = ref(true);
const mapResources = ref<readonly HistoricalMapResource[]>([]);
const mapResourceVisibility = ref<Record<string, boolean>>({});
const mapResourceOpacity = ref<Record<string, number>>({});
const viewport = ref({ west: 73, south: 18, east: 135, north: 54 });
let playbackTimer: ReturnType<typeof setInterval> | undefined;
let journeyRequestId = 0;
let mapRequestId = 0;

const typeOptions: readonly { value: EntityType; label: string }[] = [
  { value: "place", label: "地点" },
  { value: "person", label: "人物" },
  { value: "event", label: "事件" },
  { value: "site", label: "遗址" },
  { value: "artifact", label: "文物" },
];

const focusedEntityId = computed<EntityId | undefined>(() =>
  typeof route.query.entity === "string"
    ? (route.query.entity as EntityId)
    : undefined,
);

const journeyPoints = computed(() => {
  const entityId = selected.value?.entityId ?? focusedEntityId.value;
  if (!entityId) return [];
  return journeyObservations.value
    .filter((item) => item.entityId === entityId && item.occurrenceId)
    .toSorted(
      (left, right) => temporalSortValue(left) - temporalSortValue(right),
    );
});

const journeyEntityId = computed(
  () => selected.value?.entityId ?? focusedEntityId.value,
);

const sliderMin = computed(() => {
  if (startYear.value === undefined) return undefined;
  return rangeTick(startYear.value, timeResolution.value, "start");
});

const sliderMax = computed(() => {
  if (endYear.value === undefined) return undefined;
  return rangeTick(endYear.value, timeResolution.value, "end");
});

const currentTimeLabel = computed(() => {
  if (currentTick.value === undefined) return "范围模式";
  if (timeResolution.value === "year") return `${currentTick.value}年`;
  if (timeResolution.value === "day") {
    const { year, month, day } = civilFromDay(currentTick.value);
    return `${year}年${String(month).padStart(2, "0")}月${String(day).padStart(2, "0")}日`;
  }
  const { year, month } = yearMonthFromTick(currentTick.value);
  return `${year}年${String(month).padStart(2, "0")}月`;
});

const activeMapResourceIds = computed(() =>
  mapResources.value
    .filter((resource) => mapResourceVisibility.value[resource.id])
    .map((resource) => resource.id),
);

function stopPlayback() {
  if (playbackTimer) clearInterval(playbackTimer);
  playbackTimer = undefined;
  playing.value = false;
}

function applyRange() {
  stopPlayback();
  currentTick.value = undefined;
  void load();
}

function changeResolution() {
  stopPlayback();
  currentTick.value = undefined;
  playbackStep.value = 1;
}

function togglePlayback() {
  if (playing.value) {
    stopPlayback();
    return;
  }
  if (startYear.value === undefined || endYear.value === undefined) {
    error.value = "请先填写时间轴的起始年和终止年。";
    return;
  }
  if (startYear.value > endYear.value) {
    error.value = "时间轴起始年不能晚于终止年。";
    return;
  }
  error.value = "";
  currentTick.value = sliderMin.value;
  playing.value = true;
  void load();
  playbackTimer = setInterval(() => {
    if (
      currentTick.value === undefined ||
      sliderMax.value === undefined ||
      currentTick.value >= sliderMax.value
    ) {
      stopPlayback();
      return;
    }
    currentTick.value = Math.min(
      sliderMax.value,
      currentTick.value + Math.max(1, playbackStep.value),
    );
    void load();
  }, 900);
}

function handleViewport(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}) {
  viewport.value = bounds;
}

async function loadJourney(entityId: EntityId | undefined) {
  const requestId = ++journeyRequestId;
  journeyObservations.value = [];
  if (!entityId) return;

  const items: MapObservation[] = [];
  let cursor: string | undefined;
  try {
    do {
      const page = await services.atlas.explore({
        entityIds: [entityId],
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });
      items.push(...page.observations);
      cursor = page.nextCursor;
    } while (cursor && requestId === journeyRequestId);
    if (requestId === journeyRequestId) journeyObservations.value = items;
  } catch (reason) {
    if (requestId === journeyRequestId) {
      error.value =
        reason instanceof Error ? reason.message : "完整时空行迹加载失败";
    }
  }
}

async function load(append = false) {
  const requestId = ++mapRequestId;
  loading.value = true;
  error.value = "";
  if (!append) {
    observations.value = [];
    nextCursor.value = undefined;
  }
  try {
    const temporal = buildTemporalQuery({
      currentTick: currentTick.value,
      resolution: timeResolution.value,
      startYear: startYear.value,
      endYear: endYear.value,
    });
    const [page, availableResources] = await Promise.all([
      services.atlas.explore({
        ...viewport.value,
        entityTypes: activeTypes.value,
        ...(focusedEntityId.value
          ? { entityIds: [focusedEntityId.value] }
          : {}),
        limit: 100,
        ...(append && nextCursor.value ? { cursor: nextCursor.value } : {}),
        ...(temporal ? { temporal } : {}),
      }),
      services.atlas.listMapResources(temporal ? { temporal } : {}),
    ]);
    if (requestId !== mapRequestId) return;
    mapResources.value = availableResources;
    for (const resource of availableResources) {
      if (!(resource.id in mapResourceVisibility.value))
        mapResourceVisibility.value[resource.id] = resource.isDefault;
      if (!(resource.id in mapResourceOpacity.value))
        mapResourceOpacity.value[resource.id] = resource.defaultOpacity;
    }
    observations.value = append
      ? [...observations.value, ...page.observations]
      : page.observations;
    nextCursor.value = page.nextCursor;
    if (!append && focusedEntityId.value && observations.value[0]) {
      selected.value = observations.value[0];
    }
    if (
      selected.value &&
      !observations.value.some(
        (item) => item.entityId === selected.value?.entityId,
      )
    ) {
      selected.value = undefined;
    }
  } catch (reason) {
    if (requestId === mapRequestId) {
      error.value =
        reason instanceof Error ? reason.message : "时空数据加载失败";
    }
  } finally {
    if (requestId === mapRequestId) loading.value = false;
  }
}

onMounted(() => load());
onBeforeUnmount(stopPlayback);
watch(journeyEntityId, (entityId) => void loadJourney(entityId), {
  immediate: true,
});
</script>

<template>
  <section class="page atlas-page">
    <PageHeader
      eyebrow="SPATIOTEMPORAL ATLAS"
      title="无限时空"
      description="在同一张图上切换时代与对象；任何点位都能进入知识档案，并继续回到方志原文。"
    />

    <div class="atlas-controls">
      <fieldset>
        <legend>对象类型</legend>
        <label v-for="item in typeOptions" :key="item.value">
          <input v-model="activeTypes" type="checkbox" :value="item.value" />
          <span>{{ item.label }}</span>
        </label>
      </fieldset>
      <label class="filter-field"
        ><span>起始年</span
        ><input v-model.number="startYear" type="number" placeholder="如 1368"
      /></label>
      <label class="filter-field"
        ><span>终止年</span
        ><input v-model.number="endYear" type="number" placeholder="如 1644"
      /></label>
      <button class="primary-button" type="button" @click="applyRange">
        应用时空筛选
      </button>
      <button class="secondary-button" type="button" @click="load()">
        搜索当前视野
      </button>
    </div>

    <AtlasMapControls
      v-model:current-tick="currentTick"
      v-model:time-resolution="timeResolution"
      v-model:playback-step="playbackStep"
      v-model:show-points="showPoints"
      v-model:show-regions="showRegions"
      v-model:show-routes="showRoutes"
      v-model:show-labels="showLabels"
      v-model:resource-visibility="mapResourceVisibility"
      v-model:resource-opacity="mapResourceOpacity"
      :current-time-label="currentTimeLabel"
      :slider-min="sliderMin"
      :slider-max="sliderMax"
      :playing="playing"
      :map-resources="mapResources"
      @resolution-change="changeResolution"
      @tick-change="load()"
      @toggle-playback="togglePlayback"
    />

    <p v-if="error" class="error-line">{{ error }}</p>
    <p v-if="runtime.mapResourceWarning" class="error-line">
      历史地图资源未载入：{{ runtime.mapResourceWarning }}
    </p>
    <div class="atlas-layout">
      <div class="atlas-map-stage">
        <HistoricalMap
          :observations="observations"
          :selected="selected"
          :journey="journeyPoints"
          :show-points="showPoints"
          :show-regions="showRegions"
          :show-routes="showRoutes"
          :show-labels="showLabels"
          :map-resources="mapResources"
          :active-map-resource-ids="activeMapResourceIds"
          :map-resource-opacity="mapResourceOpacity"
          @select="selected = $event"
          @viewport="handleViewport"
        />
        <div v-if="loading" class="map-overlay">正在读取时空观测……</div>
        <EmptyState
          v-else-if="!observations.length"
          compact
          title="地图引擎已经就绪"
          description="加入地点身份和历史坐标后，聚合点位、历史区域、时间轴和人物行迹会直接启用。"
        />
      </div>

      <aside class="map-sidebar">
        <template v-if="selected">
          <p class="section-kicker">已选择</p>
          <h2>{{ selected.label }}</h2>
          <p>{{ selected.category }}</p>
          <p v-if="selected.temporal" class="temporal-label">
            {{ selected.temporal.original }}
          </p>
          <router-link
            class="button-link"
            :to="`/entities/${selected.entityId}`"
            >打开知识档案</router-link
          >
        </template>
        <template v-else>
          <p class="section-kicker">时空观测</p>
          <strong class="map-count">{{ observations.length }}</strong>
          <p>选择图上点位查看历史身份、时代范围与原文证据。</p>
        </template>

        <div v-if="observations.length" class="map-result-list">
          <button
            v-for="observation in observations.slice(0, 30)"
            :key="`${observation.entityId}-list-${observation.geometryId}`"
            type="button"
            @click="selected = observation"
          >
            <strong>{{ observation.label }}</strong>
            <span>{{
              observation.temporal?.original ?? observation.category
            }}</span>
          </button>
          <button
            v-if="nextCursor"
            class="map-load-more"
            type="button"
            :disabled="loading"
            @click="load(true)"
          >
            载入更多点位
          </button>
        </div>
      </aside>
    </div>
  </section>
</template>
