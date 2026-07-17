<script setup lang="ts">
import type { EntitySummary, EntityType } from "@infinite-spacetime/contracts";
import { onMounted, ref } from "vue";
import EmptyState from "../../components/EmptyState.vue";
import EntityTypeBadge from "../../components/EntityTypeBadge.vue";
import PageHeader from "../../components/PageHeader.vue";
import ReviewBadge from "../../components/ReviewBadge.vue";
import { useApplication } from "../../composables/use-application";

const { services } = useApplication();
const records = ref<readonly EntitySummary[]>([]);
const query = ref("");
const activeType = ref<EntityType>();
const loading = ref(false);
const error = ref("");
const nextCursor = ref<string>();

const types: readonly { value: EntityType; label: string }[] = [
  { value: "artifact", label: "文物" },
  { value: "site", label: "遗址" },
  { value: "institution", label: "馆藏机构" },
  { value: "material", label: "材料" },
  { value: "technique", label: "工艺" },
  { value: "motif", label: "纹样" },
  { value: "inscription", label: "铭文" },
];

async function load(reset = true) {
  loading.value = true;
  error.value = "";
  if (reset) {
    records.value = [];
    nextCursor.value = undefined;
  }
  try {
    const page = await services.knowledge.listEntities({
      types: activeType.value
        ? [activeType.value]
        : types.map((item) => item.value),
      limit: 100,
      ...(!reset && nextCursor.value ? { cursor: nextCursor.value } : {}),
      ...(query.value.trim() ? { text: query.value.trim() } : {}),
    });
    records.value = reset ? page.items : [...records.value, ...page.items];
    nextCursor.value = page.nextCursor;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "文博资料加载失败";
  } finally {
    loading.value = false;
  }
}

function chooseType(type?: EntityType) {
  activeType.value = type;
  void load(true);
}

onMounted(() => load());
</script>

<template>
  <section class="page content-page heritage-page">
    <PageHeader
      eyebrow="CULTURAL HERITAGE"
      title="文博遗产"
      description="把方志记载与文物、遗址、墓葬、馆藏、材料、工艺、纹样和铭文放回同一时空证据网络。"
    >
      <template #actions>
        <form class="inline-search" @submit.prevent="load()">
          <label class="filter-field filter-field--wide">
            <span>检索文博对象</span>
            <input
              v-model="query"
              type="search"
              placeholder="名称、别名或关键词"
            />
          </label>
          <button class="primary-button" type="submit">检索</button>
        </form>
      </template>
    </PageHeader>

    <div class="filter-chips" role="group" aria-label="文博类型">
      <button
        type="button"
        :class="{ active: !activeType }"
        @click="chooseType()"
      >
        全部
      </button>
      <button
        v-for="item in types"
        :key="item.value"
        type="button"
        :class="{ active: activeType === item.value }"
        @click="chooseType(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <p v-if="loading" class="loading-line">正在整理文博线索……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <template v-else-if="records.length">
      <div class="entity-grid">
        <router-link
          v-for="item in records"
          :key="item.entity.id"
          class="entity-card heritage-card"
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
            {{ item.entity.summary ?? "查看方志出处、历史地点与关联对象。" }}
          </p>
          <footer>
            <span>{{ item.mentionCount }} 处原文</span
            ><span>{{ item.assertionCount }} 条主张</span>
            <span>{{ item.occurrenceCount }} 条流转</span>
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
        {{ loading ? "正在载入……" : "载入更多文博对象" }}
      </button>
    </template>
    <EmptyState
      v-else
      title="文博模块已经就绪"
      description="加入文物、遗址、馆藏等实体及其方志出处后，分类浏览与档案关联会自动生效。"
    />
  </section>
</template>
