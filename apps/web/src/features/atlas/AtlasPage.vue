<script setup lang="ts">
import type {
  EntityType,
  EntityId,
  MapObservation,
  TemporalValue,
} from "@infinite-spacetime/contracts";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/useApplication";

const { services } = useApplication();
const route = useRoute();
const observations = ref<readonly MapObservation[]>([]);
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

const typeOptions: readonly { value: EntityType; label: string }[] = [
  { value: "place", label: "地点" },
  { value: "person", label: "人物" },
  { value: "event", label: "事件" },
  { value: "site", label: "遗址" },
  { value: "artifact", label: "文物" },
];

const pointObservations = computed(() =>
  observations.value.filter((item) => item.geometry.type === "Point"),
);

const focusedEntityId = computed(() =>
  typeof route.query.entity === "string" ? route.query.entity : undefined,
);

const journeyPoints = computed(() => {
  const entityId = selected.value?.entityId ?? focusedEntityId.value;
  if (!entityId) return [];
  return pointObservations.value
    .filter((item) => item.entityId === entityId && item.occurrenceId)
    .toSorted(
      (left, right) =>
        (left.temporal?.startYear ?? 0) - (right.temporal?.startYear ?? 0),
    );
});

const journeyPolyline = computed(() =>
  journeyPoints.value
    .map((item) => {
      if (item.geometry.type !== "Point") return "";
      const [longitude, latitude] = item.geometry.coordinates;
      const x = Math.min(100, Math.max(0, ((longitude - 73) / 62) * 100));
      const y = Math.min(100, Math.max(0, (1 - (latitude - 18) / 36) * 100));
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" "),
);

function temporalQuery(): TemporalValue | undefined {
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

function pointStyle(observation: MapObservation) {
  if (observation.geometry.type !== "Point") return {};
  const [longitude, latitude] = observation.geometry.coordinates;
  const left = Math.min(100, Math.max(0, ((longitude - 73) / 62) * 100));
  const top = Math.min(100, Math.max(0, (1 - (latitude - 18) / 36) * 100));
  return { left: `${left}%`, top: `${top}%` };
}

async function load(append = false) {
  loading.value = true;
  error.value = "";
  if (!append) {
    observations.value = [];
    nextCursor.value = undefined;
  }
  try {
    const temporal = temporalQuery();
    const page = await services.atlas.explore({
      west: 73,
      south: 18,
      east: 135,
      north: 54,
      entityTypes: activeTypes.value,
      ...(focusedEntityId.value
        ? { entityIds: [focusedEntityId.value as EntityId] }
        : {}),
      limit: 100,
      ...(append && nextCursor.value ? { cursor: nextCursor.value } : {}),
      ...(temporal ? { temporal } : {}),
    });
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
    error.value = reason instanceof Error ? reason.message : "时空数据加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => load());
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
      <button class="primary-button" type="button" @click="load()">
        应用时空筛选
      </button>
    </div>

    <p v-if="error" class="error-line">{{ error }}</p>
    <div class="atlas-layout">
      <div class="map-canvas" aria-label="历史地理坐标图">
        <div class="map-grid" aria-hidden="true"></div>
        <svg
          v-if="journeyPoints.length > 1"
          class="map-route-layer"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label="人物行迹连线"
        >
          <polyline :points="journeyPolyline" />
        </svg>
        <div class="map-label map-label--north">北</div>
        <div class="map-label map-label--west">73°E</div>
        <div class="map-label map-label--east">135°E</div>
        <button
          v-for="observation in pointObservations"
          :key="`${observation.entityId}-${observation.geometryId}`"
          class="map-point"
          :class="{ active: selected?.geometryId === observation.geometryId }"
          :data-category="observation.category"
          :style="pointStyle(observation)"
          type="button"
          :aria-label="observation.label"
          @click="selected = observation"
        >
          <span>{{ observation.label }}</span>
        </button>

        <div v-if="loading" class="map-overlay">正在读取时空观测……</div>
        <EmptyState
          v-else-if="!pointObservations.length"
          compact
          title="地图引擎已经就绪"
          description="加入地点身份和历史坐标后，点位、类型筛选、时代筛选与档案跳转会直接启用。"
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
