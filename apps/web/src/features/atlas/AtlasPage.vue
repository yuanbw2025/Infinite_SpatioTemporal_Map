<script setup lang="ts">
import type {
  EntityType,
  EntityId,
  MapObservation,
  TemporalValue,
} from "@infinite-spacetime/contracts";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/use-application";
import HistoricalMap from "./components/HistoricalMap.vue";

const { services } = useApplication();
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
const timeResolution = ref<"year" | "month">("year");
const playbackStep = ref(1);
const playing = ref(false);
const showPoints = ref(true);
const showRegions = ref(true);
const showRoutes = ref(true);
const showLabels = ref(true);
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
  return timeResolution.value === "month"
    ? startYear.value * 12
    : startYear.value;
});

const sliderMax = computed(() => {
  if (endYear.value === undefined) return undefined;
  return timeResolution.value === "month"
    ? endYear.value * 12 + 11
    : endYear.value;
});

const currentTimeLabel = computed(() => {
  if (currentTick.value === undefined) return "范围模式";
  if (timeResolution.value === "year") return `${currentTick.value}年`;
  const { year, month } = yearMonthFromTick(currentTick.value);
  return `${year}年${String(month).padStart(2, "0")}月`;
});

function yearMonthFromTick(tick: number): { year: number; month: number } {
  const year = Math.floor(tick / 12);
  return { year, month: tick - year * 12 + 1 };
}

function temporalSortValue(observation: MapObservation): number {
  const temporal = observation.temporal;
  const year = temporal?.startYear ?? temporal?.endYear ?? 0;
  const month = temporal?.startMonth ?? temporal?.endMonth ?? 1;
  const day = temporal?.startDay ?? temporal?.endDay ?? 1;
  return year * 372 + (month - 1) * 31 + day - 1;
}

function temporalQuery(): TemporalValue | undefined {
  if (currentTick.value !== undefined) {
    if (timeResolution.value === "month") {
      const { year, month } = yearMonthFromTick(currentTick.value);
      return {
        original: `${year}年${month}月`,
        startYear: year,
        startMonth: month,
        endYear: year,
        endMonth: month,
        certainty: "exact",
      };
    }
    return {
      original: String(currentTick.value),
      startYear: currentTick.value,
      endYear: currentTick.value,
      certainty: "exact",
    };
  }
  if (startYear.value === undefined && endYear.value === undefined)
    return undefined;
  return {
    original: [startYear.value, endYear.value]
      .filter((year) => year !== undefined)
      .join("—"),
    certainty: startYear.value === endYear.value ? "exact" : "range",
    ...(startYear.value !== undefined ? { startYear: startYear.value } : {}),
    ...(endYear.value !== undefined ? { endYear: endYear.value } : {}),
  };
}

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
    const temporal = temporalQuery();
    const page = await services.atlas.explore({
      ...viewport.value,
      entityTypes: activeTypes.value,
      ...(focusedEntityId.value ? { entityIds: [focusedEntityId.value] } : {}),
      limit: 100,
      ...(append && nextCursor.value ? { cursor: nextCursor.value } : {}),
      ...(temporal ? { temporal } : {}),
    });
    if (requestId !== mapRequestId) return;
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

    <div class="timeline-control">
      <div class="timeline-readout">
        <span>时间轴</span>
        <strong>{{ currentTimeLabel }}</strong>
      </div>
      <label class="timeline-resolution">
        <span>播放粒度</span>
        <select v-model="timeResolution" @change="changeResolution">
          <option value="year">按年</option>
          <option value="month">按月</option>
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
        @change="load()"
      />
      <label class="timeline-step">
        <span>步长（{{ timeResolution === "month" ? "月" : "年" }}）</span>
        <input v-model.number="playbackStep" type="number" min="1" />
      </label>
      <button class="timeline-play" type="button" @click="togglePlayback">
        {{ playing ? "暂停" : "播放时代变化" }}
      </button>
    </div>

    <div class="map-layer-controls" role="group" aria-label="地图图层">
      <label><input v-model="showPoints" type="checkbox" /> 点位与聚合</label>
      <label><input v-model="showRegions" type="checkbox" /> 历史区域</label>
      <label><input v-model="showRoutes" type="checkbox" /> 人物行迹</label>
      <label><input v-model="showLabels" type="checkbox" /> 地名标注</label>
    </div>

    <p v-if="error" class="error-line">{{ error }}</p>
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
