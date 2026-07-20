<script setup lang="ts">
import type {
  ReviewStatus,
  SocietyTopic,
  SocietyTopicSummary,
  ThematicRecord,
} from "@infinite-spacetime/contracts";
import { onMounted, ref } from "vue";
import AssertionList from "../../components/AssertionList.vue";
import EmptyState from "../../components/EmptyState.vue";
import EntityTypeBadge from "../../components/EntityTypeBadge.vue";
import PageHeader from "../../components/PageHeader.vue";
import ReviewBadge from "../../components/ReviewBadge.vue";
import { useApplication } from "../../composables/use-application";

const { services } = useApplication();
const records = ref<readonly ThematicRecord[]>([]);
const topics = ref<readonly SocietyTopicSummary[]>([]);
const activeTopic = ref<SocietyTopic>();
const query = ref("");
const startYear = ref<number>();
const endYear = ref<number>();
const reviewStatus = ref<ReviewStatus | "">("");
const nextCursor = ref<string>();
const loading = ref(false);
const error = ref("");

const topicLabels: Readonly<Record<SocietyTopic, string>> = {
  kinship: "家族谱系",
  education: "师承教育",
  office: "职官任官",
  association: "交往网络",
  mobility: "籍贯迁徙",
  events: "事件灾异",
  livelihood: "户口赋役与物产风俗",
};

const occurrenceLabels = {
  birth: "出生",
  death: "去世",
  native_place: "籍贯",
  residence: "居住",
  office: "任职",
  journey: "游历",
  event: "事件",
  creation: "制作",
  discovery: "发现",
  collection: "收藏",
  other: "其他",
} as const;

async function load(reset = true) {
  loading.value = true;
  error.value = "";
  if (reset) {
    records.value = [];
    nextCursor.value = undefined;
  }
  try {
    const temporal =
      startYear.value !== undefined || endYear.value !== undefined
        ? {
            original: `${startYear.value ?? "未知"}—${endYear.value ?? "未知"}`,
            ...(startYear.value === undefined
              ? {}
              : { startYear: startYear.value }),
            ...(endYear.value === undefined ? {} : { endYear: endYear.value }),
            certainty: "range" as const,
          }
        : undefined;
    const result = await services.society.explore({
      limit: 50,
      ...(query.value.trim() ? { text: query.value.trim() } : {}),
      ...(activeTopic.value ? { topics: [activeTopic.value] } : {}),
      ...(temporal ? { temporal } : {}),
      ...(reviewStatus.value ? { reviewStatuses: [reviewStatus.value] } : {}),
      ...(!reset && nextCursor.value ? { cursor: nextCursor.value } : {}),
    });
    topics.value = result.topics;
    records.value = reset
      ? result.records.items
      : [...records.value, ...result.records.items];
    nextCursor.value = result.records.nextCursor;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "地方社会加载失败";
  } finally {
    loading.value = false;
  }
}

function chooseTopic(topic?: SocietyTopic) {
  activeTopic.value = topic;
  void load();
}

onMounted(() => load());
</script>

<template>
  <section class="page content-page society-page">
    <PageHeader
      eyebrow="LOCAL SOCIETY"
      title="地方社会"
      description="以方志原文为证据，联读家族、师承、任官、交往、迁徙、事件灾异、户口赋役、物产与风俗。"
    />

    <form class="thematic-console" @submit.prevent="load()">
      <label>
        <span>人物、地点或事项</span>
        <input v-model="query" type="search" placeholder="名称、别名或摘要" />
      </label>
      <label>
        <span>起始年</span>
        <input v-model.number="startYear" type="number" />
      </label>
      <label>
        <span>终止年</span>
        <input v-model.number="endYear" type="number" />
      </label>
      <label>
        <span>审核状态</span>
        <select v-model="reviewStatus">
          <option value="">全部</option>
          <option value="reviewed">已复核</option>
          <option value="verified">已核定</option>
          <option value="disputed">有争议</option>
        </select>
      </label>
      <button class="primary-button" type="submit">组合筛选</button>
    </form>

    <div class="society-topic-grid">
      <button
        type="button"
        :class="{ active: !activeTopic }"
        @click="chooseTopic()"
      >
        <strong>{{
          topics.reduce((sum, item) => sum + item.entityCount, 0)
        }}</strong>
        <span>全部专题命中</span>
      </button>
      <button
        v-for="topic in topics"
        :key="topic.topic"
        type="button"
        :class="{ active: activeTopic === topic.topic }"
        @click="chooseTopic(topic.topic)"
      >
        <strong>{{ topic.entityCount }}</strong>
        <span>{{ topicLabels[topic.topic] }}</span>
        <small
          >{{ topic.assertionCount }} 主张 ·
          {{ topic.evidencePassageCount }} 出处</small
        >
      </button>
    </div>

    <p v-if="loading" class="loading-line">正在组合地方社会证据……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <div v-else-if="records.length" class="thematic-record-list">
      <article v-for="record in records" :key="record.entity.id" class="panel">
        <header>
          <div>
            <div class="entity-card__meta">
              <EntityTypeBadge :type="record.entity.type" />
              <ReviewBadge :status="record.entity.reviewStatus" />
            </div>
            <h2>
              <router-link :to="`/entities/${record.entity.id}`">
                {{ record.entity.preferredName }}
              </router-link>
            </h2>
          </div>
          <div class="tag-list">
            <span v-for="topic in record.topics" :key="topic">{{
              topicLabels[topic]
            }}</span>
          </div>
        </header>
        <p v-if="record.entity.summary">{{ record.entity.summary }}</p>
        <div class="thematic-record-columns">
          <section>
            <h3>关系与记载</h3>
            <AssertionList
              :assertions="record.assertions"
              :entities="record.relatedEntities"
              :perspective-entity-id="record.entity.id"
            />
          </section>
          <section>
            <h3>时空经历</h3>
            <ol v-if="record.occurrences.length" class="compact-fact-list">
              <li v-for="occurrence in record.occurrences" :key="occurrence.id">
                <strong>{{
                  occurrence.label ?? occurrenceLabels[occurrence.kind]
                }}</strong>
                <span>{{ occurrence.temporal?.original ?? "年代待考" }}</span>
                <router-link
                  v-for="evidence in occurrence.evidence"
                  :key="`${occurrence.id}-${evidence.passageId}`"
                  :to="`/reader/${evidence.passageId}`"
                  >出处</router-link
                >
              </li>
            </ol>
            <p v-else class="muted">本专题暂无时空经历。</p>
          </section>
        </div>
      </article>
      <button
        v-if="nextCursor"
        class="load-more-button"
        type="button"
        @click="load(false)"
      >
        载入更多专题记录
      </button>
    </div>
    <EmptyState
      v-else
      title="地方社会专题已经就绪"
      description="接入家族、师承、任官、交往、事件、户口赋役、物产和风俗等带证据事实后，专题网络会自动形成。"
    />
  </section>
</template>
