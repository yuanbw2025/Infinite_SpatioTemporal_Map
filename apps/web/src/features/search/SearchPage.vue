<script setup lang="ts">
import type { EntityType, SearchHit } from "@infinite-spacetime/contracts";
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import EntityTypeBadge from "../../components/EntityTypeBadge.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/useApplication";

const route = useRoute();
const router = useRouter();
const { services } = useApplication();
const query = ref("");
const entityType = ref<EntityType>();
const hits = ref<readonly SearchHit[]>([]);
const searched = ref(false);
const loading = ref(false);
const error = ref("");
const nextCursor = ref<string>();

const entityTypes: readonly { value: EntityType; label: string }[] = [
  { value: "person", label: "人物" },
  { value: "place", label: "地点" },
  { value: "event", label: "事件" },
  { value: "office", label: "官职" },
  { value: "institution", label: "机构" },
  { value: "artifact", label: "文物" },
  { value: "site", label: "遗址" },
];

async function search(updateUrl = true, append = false) {
  const text = query.value.trim();
  if (!text) {
    hits.value = [];
    nextCursor.value = undefined;
    searched.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  if (!append) {
    hits.value = [];
    nextCursor.value = undefined;
  }
  if (updateUrl) {
    const nextQuery = {
      q: text,
      ...(entityType.value ? { type: entityType.value } : {}),
    };
    const unchanged =
      route.query.q === nextQuery.q &&
      route.query.type === ("type" in nextQuery ? nextQuery.type : undefined);
    if (!unchanged) {
      await router.replace({ query: nextQuery });
      loading.value = false;
      return;
    }
  }
  try {
    const page = await services.search.run({
      text,
      limit: 100,
      ...(append && nextCursor.value ? { cursor: nextCursor.value } : {}),
      ...(entityType.value ? { entityTypes: [entityType.value] } : {}),
    });
    hits.value = append ? [...hits.value, ...page.items] : page.items;
    nextCursor.value = page.nextCursor;
    searched.value = true;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "检索失败";
  } finally {
    loading.value = false;
  }
}

watch(
  () => [route.query.q, route.query.type],
  () => {
    query.value = typeof route.query.q === "string" ? route.query.q : "";
    const type = route.query.type;
    entityType.value = entityTypes.some((item) => item.value === type)
      ? (type as EntityType)
      : undefined;
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
      <button class="primary-button" type="submit">检索全库</button>
    </form>

    <p v-if="loading" class="loading-line">正在检索文献与知识网络……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <div v-else-if="hits.length" class="search-results">
      <p class="result-count">找到 {{ hits.length }} 条结果</p>
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
              hit.work.describedRegion ??
              "进入版本与卷章目录"
            }}
          </p>
        </template>
        <template v-else-if="hit.kind === 'passage'">
          <span class="result-kind">原文</span>
          <h2>
            <router-link :to="`/reader/${hit.passage.id}`">{{
              hit.passage.source.sectionLabel ?? hit.passage.source.volumeLabel
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
  </section>
</template>
