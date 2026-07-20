<script setup lang="ts">
import type {
  EntityType,
  ReviewStatus,
  SearchHit,
  SearchMode,
  TemporalValue,
  Work,
  WorkId,
} from "@infinite-spacetime/contracts";
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import EntityTypeBadge from "../../components/EntityTypeBadge.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/use-application";

const route = useRoute();
const router = useRouter();
const { services } = useApplication();
const query = ref("");
const mode = ref<SearchMode>("lexical");
const entityType = ref<EntityType>();
const workId = ref<WorkId>();
const region = ref("");
const startYear = ref<number>();
const endYear = ref<number>();
const reviewStatus = ref<ReviewStatus>();
const works = ref<readonly Work[]>([]);
const hits = ref<readonly SearchHit[]>([]);
const searched = ref(false);
const loading = ref(false);
const error = ref("");
const nextCursor = ref<string>();
const executedMode = ref<SearchMode>();
const searchNotice = ref("");

const entityTypes: readonly { value: EntityType; label: string }[] = [
  { value: "person", label: "人物" },
  { value: "place", label: "地点" },
  { value: "event", label: "事件" },
  { value: "office", label: "官职" },
  { value: "institution", label: "机构" },
  { value: "artifact", label: "文物" },
  { value: "site", label: "遗址" },
];

const reviewStatuses: readonly { value: ReviewStatus; label: string }[] = [
  { value: "raw", label: "原始录入" },
  { value: "machine_suggested", label: "机器建议" },
  { value: "reviewed", label: "已复核" },
  { value: "verified", label: "已核定" },
  { value: "disputed", label: "有争议" },
  { value: "rejected", label: "已驳回" },
];

function temporalQuery(): TemporalValue | undefined {
  if (startYear.value === undefined && endYear.value === undefined)
    return undefined;
  return {
    original: [startYear.value, endYear.value]
      .filter((value) => value !== undefined)
      .join("—"),
    certainty: startYear.value === endYear.value ? "exact" : "range",
    ...(startYear.value !== undefined ? { startYear: startYear.value } : {}),
    ...(endYear.value !== undefined ? { endYear: endYear.value } : {}),
  };
}

function routeString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function routeYear(value: unknown): number | undefined {
  const text = routeString(value);
  if (!text) return undefined;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function search(updateUrl = true, append = false) {
  const text = query.value.trim();
  if (!text) {
    hits.value = [];
    nextCursor.value = undefined;
    searchNotice.value = "";
    executedMode.value = undefined;
    searched.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  if (!append) {
    hits.value = [];
    nextCursor.value = undefined;
    searchNotice.value = "";
    executedMode.value = undefined;
  }
  if (updateUrl) {
    const nextQuery = {
      q: text,
      ...(entityType.value ? { type: entityType.value } : {}),
      ...(workId.value ? { work: workId.value } : {}),
      ...(region.value.trim() ? { region: region.value.trim() } : {}),
      ...(startYear.value !== undefined
        ? { start: String(startYear.value) }
        : {}),
      ...(endYear.value !== undefined ? { end: String(endYear.value) } : {}),
      ...(reviewStatus.value ? { review: reviewStatus.value } : {}),
      ...(mode.value !== "lexical" ? { mode: mode.value } : {}),
    };
    const unchanged = JSON.stringify(route.query) === JSON.stringify(nextQuery);
    if (!unchanged) {
      await router.replace({ query: nextQuery });
      loading.value = false;
      return;
    }
  }
  try {
    const temporal = temporalQuery();
    const page = await services.search.run({
      text,
      mode: mode.value,
      limit: 100,
      ...(append && nextCursor.value ? { cursor: nextCursor.value } : {}),
      ...(entityType.value ? { entityTypes: [entityType.value] } : {}),
      ...(workId.value ? { workIds: [workId.value] } : {}),
      ...(region.value.trim() ? { region: region.value.trim() } : {}),
      ...(temporal ? { temporal } : {}),
      ...(reviewStatus.value ? { reviewStatuses: [reviewStatus.value] } : {}),
    });
    hits.value = append ? [...hits.value, ...page.items] : page.items;
    nextCursor.value = page.nextCursor;
    executedMode.value = page.executedMode;
    searchNotice.value = page.notice ?? "";
    searched.value = true;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "检索失败";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    const page = await services.library.listWorks({ limit: 200 });
    works.value = page.items;
  } catch {
    // Search remains available even if the optional source list fails.
  }
});

watch(
  () => [
    route.query.q,
    route.query.type,
    route.query.work,
    route.query.region,
    route.query.start,
    route.query.end,
    route.query.review,
    route.query.mode,
  ],
  () => {
    query.value = routeString(route.query.q) ?? "";
    const type = route.query.type;
    entityType.value = entityTypes.some((item) => item.value === type)
      ? (type as EntityType)
      : undefined;
    workId.value = routeString(route.query.work) as WorkId | undefined;
    region.value = routeString(route.query.region) ?? "";
    startYear.value = routeYear(route.query.start);
    endYear.value = routeYear(route.query.end);
    const review = route.query.review;
    reviewStatus.value = reviewStatuses.some((item) => item.value === review)
      ? (review as ReviewStatus)
      : undefined;
    const requestedMode = route.query.mode;
    mode.value =
      requestedMode === "semantic" || requestedMode === "hybrid"
        ? requestedMode
        : "lexical";
    void search(false);
  },
  { immediate: true },
);
</script>

<template>
  <section class="page content-page search-page">
    <PageHeader
      eyebrow="GLOBAL DISCOVERY"
      title="全库检索"
      description="同时检索书目、原文与知识实体；结果始终保留其所属文献和证据入口。"
    />

    <form class="search-console" role="search" @submit.prevent="search()">
      <label>
        <span>关键词</span>
        <input
          v-model="query"
          type="search"
          placeholder="例如：金陵、王守仁、青瓷"
          autofocus
        />
      </label>
      <label>
        <span>实体类型</span>
        <select v-model="entityType">
          <option :value="undefined">全部类型</option>
          <option
            v-for="item in entityTypes"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
      </label>
      <label>
        <span>检索方式</span>
        <select v-model="mode">
          <option value="lexical">词面检索</option>
          <option value="semantic">语义检索</option>
          <option value="hybrid">混合检索</option>
        </select>
      </label>
      <button class="primary-button" type="submit">检索全库</button>
      <div class="search-advanced">
        <label>
          <span>限定文献</span>
          <select v-model="workId">
            <option :value="undefined">全部文献</option>
            <option v-for="work in works" :key="work.id" :value="work.id">
              {{ work.title }}
            </option>
          </select>
        </label>
        <label>
          <span>地域</span>
          <input v-model="region" type="text" placeholder="如：南京府" />
        </label>
        <label>
          <span>起始年</span>
          <input v-model.number="startYear" type="number" placeholder="1368" />
        </label>
        <label>
          <span>终止年</span>
          <input v-model.number="endYear" type="number" placeholder="1644" />
        </label>
        <label>
          <span>审核状态</span>
          <select v-model="reviewStatus">
            <option :value="undefined">全部状态</option>
            <option
              v-for="item in reviewStatuses"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </option>
          </select>
        </label>
      </div>
    </form>

    <p v-if="loading" class="loading-line">正在检索文献与知识网络……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <template v-else>
      <p v-if="searchNotice" class="data-notice">{{ searchNotice }}</p>
      <div v-if="hits.length" class="search-results">
        <p class="result-count">
          找到 {{ hits.length }} 条结果 · 实际执行 {{ executedMode }}
        </p>
        <article
          v-for="(hit, index) in hits"
          :key="`${hit.kind}-${index}`"
          class="search-result"
        >
          <template v-if="hit.kind === 'work'">
            <span class="result-kind">方志</span>
            <h2>
              <router-link :to="`/works/${hit.work.id}`">{{
                hit.work.title
              }}</router-link>
            </h2>
            <p>
              {{
                hit.work.abstract ??
                hit.work.coverage?.regionLabels.join("、") ??
                "进入版本与卷章目录"
              }}
            </p>
          </template>
          <template v-else-if="hit.kind === 'passage'">
            <span class="result-kind">原文</span>
            <h2>
              <router-link :to="`/reader/${hit.passage.id}`">{{
                hit.passage.sectionLabel ?? hit.passage.volumeId
              }}</router-link>
            </h2>
            <p class="serif-snippet">
              {{ hit.passage.text.original.slice(0, 160)
              }}{{ hit.passage.text.original.length > 160 ? "…" : "" }}
            </p>
          </template>
          <template v-else>
            <EntityTypeBadge :type="hit.entity.type" />
            <h2>
              <router-link :to="`/entities/${hit.entity.id}`">{{
                hit.entity.preferredName
              }}</router-link>
            </h2>
            <p>{{ hit.entity.summary ?? hit.entity.aliases.join("、") }}</p>
          </template>
        </article>
        <button
          v-if="nextCursor"
          class="load-more-button"
          type="button"
          :disabled="loading"
          @click="search(false, true)"
        >
          {{ loading ? "正在载入……" : "载入更多结果" }}
        </button>
      </div>
      <EmptyState
        v-else-if="searched"
        title="没有找到匹配内容"
        description="可以减少筛选条件，或尝试历史地名、人物别名和原文用字。"
      />
      <section v-else class="search-guide">
        <article>
          <strong>找原文</strong><span>搜索正文用字，直接进入可引用段落。</span>
        </article>
        <article>
          <strong>找人物与地点</strong
          ><span>规范名和异名会指向同一知识档案。</span>
        </article>
        <article>
          <strong>找文博线索</strong
          ><span>文物、遗址、工艺与铭文共享检索入口。</span>
        </article>
      </section>
    </template>
  </section>
</template>
