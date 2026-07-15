<script setup lang="ts">
import type {
  Entity,
  EntityType,
  Mention,
  PassageContext,
  PassageId,
  Work,
} from "@infinite-spacetime/contracts";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AssertionList from "../../components/AssertionList.vue";
import EmptyState from "../../components/EmptyState.vue";
import EntityTypeBadge from "../../components/EntityTypeBadge.vue";
import PageHeader from "../../components/PageHeader.vue";
import ReviewBadge from "../../components/ReviewBadge.vue";
import { useApplication } from "../../composables/useApplication";

type TextLayer = "original" | "simplified" | "modernTranslation";
interface TextSegment {
  readonly text: string;
  readonly mention?: Mention;
  readonly entity?: Entity;
}

const route = useRoute();
const { services } = useApplication();
const context = ref<PassageContext>();
const works = ref<readonly Work[]>([]);
const activeLayer = ref<TextLayer>("original");
const loading = ref(false);
const error = ref("");

const passageId = computed(() => {
  const value = route.params.passageId;
  return typeof value === "string" ? (value as PassageId) : undefined;
});

const displayedText = computed(() => {
  const passage = context.value?.passage;
  if (!passage) return "";
  return passage.text[activeLayer.value] ?? "";
});

const segments = computed<readonly TextSegment[]>(() => {
  const current = context.value;
  if (!current || activeLayer.value !== "original") {
    return displayedText.value ? [{ text: displayedText.value }] : [];
  }
  const result: TextSegment[] = [];
  const mentions = [...current.mentions].sort((a, b) => a.start - b.start);
  const entityMap = new Map(
    current.mentionedEntities.map((entity) => [entity.id, entity]),
  );
  let cursor = 0;
  for (const mention of mentions) {
    if (mention.start < cursor) continue;
    if (mention.start > cursor) {
      result.push({
        text: current.passage.text.original.slice(cursor, mention.start),
      });
    }
    const entity = entityMap.get(mention.entityId);
    result.push({
      text: current.passage.text.original.slice(mention.start, mention.end),
      mention,
      ...(entity ? { entity } : {}),
    });
    cursor = mention.end;
  }
  if (cursor < current.passage.text.original.length) {
    result.push({ text: current.passage.text.original.slice(cursor) });
  }
  return result;
});

function entityTypeForMention(mention: Mention): EntityType {
  return (
    context.value?.mentionedEntities.find(
      (entity) => entity.id === mention.entityId,
    )?.type ?? "time"
  );
}

async function load() {
  loading.value = true;
  error.value = "";
  context.value = undefined;
  try {
    if (passageId.value) {
      context.value = await services.reader.readPassage(passageId.value);
      activeLayer.value = "original";
    } else {
      works.value = (await services.library.listWorks({ limit: 200 })).items;
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "段落加载失败";
  } finally {
    loading.value = false;
  }
}

watch(passageId, load, { immediate: true });
</script>

<template>
  <section class="page reader-page">
    <p v-if="loading" class="loading-line">正在打开原文与出处……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>

    <template v-else-if="context">
      <header class="reader-toolbar">
        <div>
          <p class="eyebrow">GAZETTEER READER</p>
          <h1>
            {{
              context.passage.source.sectionLabel ??
              context.passage.source.volumeLabel
            }}
          </h1>
          <p>
            {{ context.passage.source.volumeLabel }} · 段落
            {{ context.passage.sequence + 1 }}
          </p>
        </div>
        <div class="layer-tabs" role="group" aria-label="文本层">
          <button
            type="button"
            :class="{ active: activeLayer === 'original' }"
            @click="activeLayer = 'original'"
          >
            原文
          </button>
          <button
            type="button"
            :disabled="!context.passage.text.simplified"
            :class="{ active: activeLayer === 'simplified' }"
            @click="activeLayer = 'simplified'"
          >
            简体
          </button>
          <button
            type="button"
            :disabled="!context.passage.text.modernTranslation"
            :class="{ active: activeLayer === 'modernTranslation' }"
            @click="activeLayer = 'modernTranslation'"
          >
            白话
          </button>
        </div>
      </header>

      <div class="reader-layout">
        <article class="text-panel">
          <p v-if="segments.length" class="historical-text">
            <template v-for="(segment, index) in segments" :key="index">
              <router-link
                v-if="segment.mention && segment.entity"
                class="entity-mention"
                :data-type="segment.entity.type"
                :to="`/entities/${segment.entity.id}`"
                :title="`${segment.entity.preferredName} · 查看档案`"
                >{{ segment.text }}</router-link
              >
              <span v-else>{{ segment.text }}</span>
            </template>
          </p>
          <EmptyState
            v-else
            compact
            title="这一文本层尚未提供"
            description="原文保持不变；简体转换和白话译文可以随后独立加入。"
          />

          <figure v-if="context.passage.facsimile" class="facsimile-panel">
            <img
              v-if="context.passage.facsimile.imageUrl"
              :src="context.passage.facsimile.imageUrl"
              alt="方志影印页"
            />
            <a
              v-else-if="context.passage.facsimile.canvasUrl"
              class="button-link"
              :href="context.passage.facsimile.canvasUrl"
              target="_blank"
              rel="noreferrer"
              >打开 IIIF 影印画布</a
            >
            <figcaption>
              影印页 {{ context.passage.facsimile.pageId }}
            </figcaption>
          </figure>

          <nav class="passage-nav" aria-label="段落导航">
            <router-link
              v-if="context.previousPassageId"
              :to="`/reader/${context.previousPassageId}`"
              >← 上一段</router-link
            >
            <span v-else>已是首段</span>
            <router-link
              v-if="context.nextPassageId"
              :to="`/reader/${context.nextPassageId}`"
              >下一段 →</router-link
            >
            <span v-else>已是末段</span>
          </nav>
        </article>

        <aside class="annotation-panel">
          <section>
            <p class="section-kicker">本段实体</p>
            <div v-if="context.mentions.length" class="mention-list">
              <router-link
                v-for="mention in context.mentions"
                :key="mention.id"
                :to="`/entities/${mention.entityId}`"
              >
                <span>
                  <strong>{{ mention.surface }}</strong>
                  <EntityTypeBadge :type="entityTypeForMention(mention)" />
                </span>
                <ReviewBadge :status="mention.reviewStatus" />
              </router-link>
            </div>
            <p v-else class="muted">本段暂无实体标注。</p>
          </section>

          <section>
            <p class="section-kicker">由本段支撑的主张</p>
            <AssertionList
              :assertions="context.evidencedAssertions"
              :entities="context.mentionedEntities"
            />
          </section>
        </aside>
      </div>
    </template>

    <template v-else>
      <PageHeader
        eyebrow="GAZETTEER READER"
        title="方志精读"
        description="选择一部方志进入段落目录；阅读器将原文、简体、白话、实体标注与影印页保持在同一引用坐标。"
      />
      <div v-if="works.length" class="work-grid compact-grid">
        <router-link
          v-for="work in works"
          :key="work.id"
          class="work-card"
          :to="`/works/${work.id}`"
        >
          <h2>{{ work.title }}</h2>
          <p>进入卷章与段落目录。</p>
          <strong>开始阅读 →</strong>
        </router-link>
      </div>
      <EmptyState
        v-else
        title="阅读器已经就绪"
        description="接入包含段落的发布包后，可从书库进入原文、简体、译文、实体标注与影印联读。"
      />
    </template>
  </section>
</template>
