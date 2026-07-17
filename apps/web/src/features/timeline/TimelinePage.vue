<script setup lang="ts">
import type {
  EntityId,
  EntityType,
  TimelineItem,
  TimelineResult,
} from "@infinite-spacetime/contracts";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import EntityTypeBadge from "../../components/EntityTypeBadge.vue";
import PageHeader from "../../components/PageHeader.vue";
import ReviewBadge from "../../components/ReviewBadge.vue";
import { useApplication } from "../../composables/use-application";

const route = useRoute();
const router = useRouter();
const { services } = useApplication();
const timeline = ref<TimelineResult>();
const startYear = ref<number>();
const endYear = ref<number>();
const loading = ref(false);
const error = ref("");
const activeTypes = ref<EntityType[]>(["person", "event", "artifact", "site"]);
const timelineTypes: readonly EntityType[] = [
  "person",
  "event",
  "artifact",
  "site",
];

const focusedEntityId = computed<EntityId | undefined>(() =>
  typeof route.query.entity === "string"
    ? (route.query.entity as EntityId)
    : undefined,
);

function itemPosition(item: TimelineItem): number {
  const range = timeline.value?.range;
  const baseYear = item.temporal.startYear ?? item.temporal.endYear;
  const month = item.temporal.startMonth ?? item.temporal.endMonth;
  const day = item.temporal.startDay ?? item.temporal.endDay;
  const year =
    baseYear === undefined
      ? undefined
      : baseYear + ((month ?? 1) - 1) / 12 + ((day ?? 1) - 1) / 366;
  if (!range || year === undefined || range.startYear === range.endYear)
    return 50;
  return ((year - range.startYear) / (range.endYear - range.startYear)) * 100;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    timeline.value = await services.timeline.build({
      ...(focusedEntityId.value ? { entityIds: [focusedEntityId.value] } : {}),
      ...(activeTypes.value.length ? { entityTypes: activeTypes.value } : {}),
      ...(startYear.value !== undefined ? { startYear: startYear.value } : {}),
      ...(endYear.value !== undefined ? { endYear: endYear.value } : {}),
      limit: 800,
    });
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "时间线加载失败";
  } finally {
    loading.value = false;
  }
}

function clearFocus() {
  void router.push({ path: "/timeline" });
}

watch([focusedEntityId, activeTypes], load, { immediate: true, deep: true });
</script>

<template>
  <section class="page content-page chronology-page">
    <PageHeader
      eyebrow="HISTORICAL TIMELINE"
      title="历史时间线"
      description="把人物、事件与文物流转排到同一时间坐标；古代纪年原文与公元范围并列保存。"
    />

    <div class="timeline-filters">
      <label class="filter-field"
        ><span>起始年</span><input v-model.number="startYear" type="number"
      /></label>
      <label class="filter-field"
        ><span>终止年</span><input v-model.number="endYear" type="number"
      /></label>
      <button class="primary-button" type="button" @click="load">
        应用范围
      </button>
      <button
        v-if="focusedEntityId"
        class="secondary-button"
        type="button"
        @click="clearFocus"
      >
        返回全库时间线
      </button>
      <div class="timeline-type-filter">
        <label v-for="type in timelineTypes" :key="type">
          <input v-model="activeTypes" type="checkbox" :value="type" />
          <EntityTypeBadge :type="type" />
        </label>
      </div>
    </div>

    <p v-if="loading" class="loading-line">正在编排时间轨道……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <div v-else-if="timeline?.tracks.length" class="timeline-board">
      <header v-if="timeline.range" class="timeline-axis">
        <strong>{{ timeline.range.startYear }}</strong>
        <span>公元纪年轴</span>
        <strong>{{ timeline.range.endYear }}</strong>
      </header>
      <article
        v-for="track in timeline.tracks"
        :key="track.entity.id"
        class="timeline-track panel"
      >
        <header>
          <EntityTypeBadge :type="track.entity.type" />
          <router-link :to="`/entities/${track.entity.id}`">{{
            track.entity.preferredName
          }}</router-link>
          <span>{{ track.items.length }} 个时间节点</span>
        </header>
        <div class="timeline-track__rail">
          <span
            v-for="item in track.items"
            :key="item.id"
            class="timeline-track__marker"
            :style="{ left: `${itemPosition(item)}%` }"
            :title="`${item.temporal.original} · ${item.label}`"
          />
        </div>
        <ol class="timeline-event-list">
          <li v-for="item in track.items" :key="`detail-${item.id}`">
            <time>{{ item.temporal.original }}</time>
            <div>
              <strong>{{ item.label }}</strong>
              <span v-if="item.temporal.startYear !== undefined"
                >公元 {{ item.temporal.startYear
                }}<template
                  v-if="
                    item.temporal.endYear !== undefined &&
                    item.temporal.endYear !== item.temporal.startYear
                  "
                  >—{{ item.temporal.endYear }}</template
                ></span
              >
            </div>
            <ReviewBadge :status="item.reviewStatus" />
            <router-link
              v-if="item.evidence[0]"
              :to="`/reader/${item.evidence[0].passageId}`"
              >原文</router-link
            >
          </li>
        </ol>
      </article>
      <p v-if="timeline.undatedCount" class="muted">
        另有
        {{ timeline.undatedCount }}
        条记录保留了原始描述，但尚不能可靠换算为公元纪年。
      </p>
    </div>
    <EmptyState
      v-else
      title="时间线能力已经就绪"
      description="为 Assertion 或 SpatiotemporalOccurrence 提供 TemporalValue 后，人物生平、地方事件与文物流转会自动形成时间轨道。"
    />
  </section>
</template>
