<script setup lang="ts">
import type { EntitySummary } from "@infinite-spacetime/contracts";
import { onMounted, ref } from "vue";
import EmptyState from "../../components/EmptyState.vue";
import EntityTypeBadge from "../../components/EntityTypeBadge.vue";
import PageHeader from "../../components/PageHeader.vue";
import ReviewBadge from "../../components/ReviewBadge.vue";
import { useApplication } from "../../composables/useApplication";

const { services } = useApplication();
const people = ref<readonly EntitySummary[]>([]);
const query = ref("");
const loading = ref(false);
const error = ref("");
const nextCursor = ref<string>();

async function load(reset = true) {
  loading.value = true;
  error.value = "";
  if (reset) {
    people.value = [];
    nextCursor.value = undefined;
  }
  try {
    const page = await services.knowledge.listEntities({
      types: ["person"],
      limit: 100,
      ...(!reset && nextCursor.value ? { cursor: nextCursor.value } : {}),
      ...(query.value.trim() ? { text: query.value.trim() } : {}),
    });
    people.value = reset ? page.items : [...people.value, ...page.items];
    nextCursor.value = page.nextCursor;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "人物加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => load());
</script>

<template>
  <section class="page content-page">
    <PageHeader
      eyebrow="PEOPLE &amp; JOURNEYS"
      title="人物行迹"
      description="从籍贯、任职、游历和交往进入地方社会；每段经历都保留时代、地点与原文证据。"
    >
      <template #actions>
        <form class="inline-search" @submit.prevent="load()">
          <label class="filter-field filter-field--wide">
            <span>查找人物</span>
            <input v-model="query" type="search" placeholder="姓名或别名" />
          </label>
          <button class="primary-button" type="submit">筛选</button>
        </form>
      </template>
    </PageHeader>

    <p v-if="loading" class="loading-line">正在汇集人物档案……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <template v-else-if="people.length">
      <div class="entity-grid">
        <router-link
          v-for="item in people"
          :key="item.entity.id"
          class="entity-card"
          :to="`/entities/${item.entity.id}`"
        >
          <div class="entity-card__meta">
            <EntityTypeBadge :type="item.entity.type" />
            <ReviewBadge
              v-if="item.entity.reviewStatus"
              :status="item.entity.reviewStatus"
            />
          </div>
          <h2>{{ item.entity.preferredName }}</h2>
          <p>
            {{
              item.entity.summary ??
              (item.entity.aliases.join("、") || "档案摘要待整理")
            }}
          </p>
          <footer>
            <span>{{ item.mentionCount }} 处原文</span>
            <span>{{ item.assertionCount }} 条主张</span>
            <span>{{ item.occurrenceCount }} 段行迹</span>
          </footer>
        </router-link>
      </div>
      <button
        v-if="nextCursor"
        class="load-more-button"
        type="button"
        :disabled="loading"
        @click="load(false)"
      >
        {{ loading ? "正在载入……" : "载入更多人物" }}
      </button>
    </template>
    <EmptyState
      v-else
      title="人物功能已经就绪"
      description="发布 person 实体、原文提及与带证据主张后，这里会自动形成可检索的人物档案。"
    />
  </section>
</template>
