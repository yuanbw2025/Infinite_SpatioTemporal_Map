<script setup lang="ts">
import type { Work } from "@infinite-spacetime/contracts";
import { onMounted, ref } from "vue";
import EmptyState from "../../components/EmptyState.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/useApplication";

const runtime = useApplication();
const { services } = runtime;
const works = ref<readonly Work[]>([]);
const loading = ref(true);
const error = ref("");
const query = ref("");
const region = ref("");
const startYear = ref<number>();
const endYear = ref<number>();
const nextCursor = ref<string>();

async function loadMore(reset = false) {
  if (loading.value && works.value.length) return;
  loading.value = true;
  error.value = "";
  if (reset) {
    works.value = [];
    nextCursor.value = undefined;
  }
  try {
    const hasTemporal =
      startYear.value !== undefined || endYear.value !== undefined;
    const page = await services.library.listWorks({
      limit: 100,
      ...(!reset && nextCursor.value ? { cursor: nextCursor.value } : {}),
      ...(query.value.trim() ? { text: query.value.trim() } : {}),
      ...(region.value.trim() ? { region: region.value.trim() } : {}),
      ...(hasTemporal
        ? {
            temporal: {
              original: [startYear.value, endYear.value]
                .filter((value) => value !== undefined)
                .join("—"),
              certainty: "range",
              ...(startYear.value !== undefined
                ? { startYear: startYear.value }
                : {}),
              ...(endYear.value !== undefined
                ? { endYear: endYear.value }
                : {}),
            },
          }
        : {}),
    });
    works.value = [...works.value, ...page.items];
    nextCursor.value = page.nextCursor;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "书目加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => loadMore());
</script>

<template>
  <section class="page library-page">
    <PageHeader
      eyebrow="LOCAL GAZETTEER LIBRARY"
      title="从一部方志，进入一方历代社会。"
      description="按地区、时代与版本浏览地方志；所有人物、地点、事件与文博线索都从可回溯的原文出发。"
    >
      <template #actions>
        <form class="library-search" @submit.prevent="loadMore(true)">
          <label class="filter-field filter-field--wide">
            <span>书名或关键词</span>
            <input v-model="query" type="search" placeholder="输入书名或别名" />
          </label>
          <label class="filter-field">
            <span>地区</span>
            <input v-model="region" type="search" placeholder="府、州、县" />
          </label>
          <label class="filter-field year-field">
            <span>起始年</span>
            <input
              v-model.number="startYear"
              type="number"
              placeholder="1368"
            />
          </label>
          <label class="filter-field year-field">
            <span>终止年</span>
            <input v-model.number="endYear" type="number" placeholder="1644" />
          </label>
          <button class="primary-button" type="submit">筛选书库</button>
        </form>
      </template>
    </PageHeader>

    <p v-if="loading" class="loading-line">正在整理书目……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>

    <template v-else-if="works.length">
      <div class="work-grid">
        <router-link
          v-for="work in works"
          :key="work.id"
          class="work-card"
          :to="`/works/${work.id}`"
        >
          <span class="work-card__category">{{ work.category }}</span>
          <h2>{{ work.title }}</h2>
          <p>{{ work.abstract ?? "进入版本、卷章与全文目录。" }}</p>
          <footer>
            <span>{{ work.describedRegion ?? "地域待标注" }}</span>
            <span v-if="work.coverage?.temporal">{{
              work.coverage.temporal.original
            }}</span>
            <strong>进入方志 →</strong>
          </footer>
        </router-link>
      </div>
      <button
        v-if="nextCursor"
        class="load-more-button"
        type="button"
        :disabled="loading"
        @click="loadMore(false)"
      >
        {{ loading ? "正在载入……" : "载入更多书目" }}
      </button>
    </template>

    <EmptyState
      v-else
      :title="
        runtime.overview.counts.works
          ? '没有符合条件的方志'
          : '书库已经就绪，等待首批方志'
      "
      :description="
        runtime.overview.counts.works
          ? '可以放宽地区或年代条件重新筛选。'
          : '正式发布包加入 works、editions、volumes 和 passages 后，书目与阅读入口会自动出现。'
      "
    >
      <router-link class="button-link" to="/data">查看数据接入方式</router-link>
    </EmptyState>

    <section class="principle-strip" aria-label="项目原则">
      <article>
        <strong>原文不动</strong><span>简体和译文作为独立文本层保存。</span>
      </article>
      <article>
        <strong>证据优先</strong
        ><span>每个人物、地点与事件都能返回具体段落。</span>
      </article>
      <article>
        <strong>时空相连</strong><span>同一地点的名称和隶属随时代展开。</span>
      </article>
    </section>
  </section>
</template>
