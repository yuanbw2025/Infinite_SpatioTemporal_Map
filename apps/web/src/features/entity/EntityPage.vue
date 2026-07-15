<script setup lang="ts">
import type { EntityId, EntityProfile } from "@infinite-spacetime/contracts";
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import AssertionList from "../../components/AssertionList.vue";
import EmptyState from "../../components/EmptyState.vue";
import EntityTypeBadge from "../../components/EntityTypeBadge.vue";
import PageHeader from "../../components/PageHeader.vue";
import ReviewBadge from "../../components/ReviewBadge.vue";
import { useApplication } from "../../composables/useApplication";

const route = useRoute();
const { services } = useApplication();
const profile = ref<EntityProfile>();
const loading = ref(true);
const error = ref("");

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

async function load() {
  const entityId = route.params.entityId;
  if (typeof entityId !== "string") return;
  loading.value = true;
  error.value = "";
  try {
    profile.value = await services.knowledge.openEntity(entityId as EntityId);
  } catch (reason) {
    profile.value = undefined;
    error.value = reason instanceof Error ? reason.message : "实体档案加载失败";
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.entityId, load, { immediate: true });
</script>

<template>
  <section class="page content-page entity-page">
    <p v-if="loading" class="loading-line">正在汇集出处与关系……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <template v-else-if="profile">
      <PageHeader
        eyebrow="KNOWLEDGE PROFILE"
        :title="profile.entity.preferredName"
        :description="
          profile.entity.summary ?? '这个档案由原文提及与带证据的知识主张组成。'
        "
      >
        <template #actions>
          <EntityTypeBadge :type="profile.entity.type" />
          <ReviewBadge
            v-if="profile.entity.reviewStatus"
            :status="profile.entity.reviewStatus"
          />
        </template>
      </PageHeader>

      <div class="entity-layout">
        <main class="entity-main">
          <section v-if="profile.occurrences.length" class="panel">
            <div class="section-heading">
              <p class="section-kicker">时空经历</p>
              <router-link
                :to="{ path: '/atlas', query: { entity: profile.entity.id } }"
                >在地图中查看</router-link
              >
            </div>
            <ol class="occurrence-list">
              <li
                v-for="occurrence in profile.occurrences"
                :key="occurrence.id"
              >
                <span class="occurrence-kind">{{
                  occurrenceLabels[occurrence.kind]
                }}</span>
                <div>
                  <strong>{{
                    occurrence.label ??
                    profile.occurrencePlaces.find(
                      (place) => place.id === occurrence.placeId,
                    )?.preferredName ??
                    occurrence.placeId
                  }}</strong>
                  <p v-if="occurrence.temporal">
                    {{ occurrence.temporal.original }}
                  </p>
                  <div class="evidence-links">
                    <router-link
                      v-for="(evidence, index) in occurrence.evidence"
                      :key="`${evidence.passageId}-${index}`"
                      :to="`/reader/${evidence.passageId}`"
                      >查看出处 {{ index + 1 }}</router-link
                    >
                  </div>
                </div>
                <ReviewBadge :status="occurrence.reviewStatus" />
              </li>
            </ol>
          </section>

          <section class="panel">
            <p class="section-kicker">知识主张</p>
            <AssertionList
              :assertions="profile.assertions"
              :entities="profile.relatedEntities"
            />
          </section>

          <section class="panel">
            <p class="section-kicker">原文出现</p>
            <div v-if="profile.mentions.length" class="appearance-list">
              <router-link
                v-for="mention in profile.mentions"
                :key="mention.id"
                :to="`/reader/${mention.passageId}`"
              >
                <strong>{{ mention.surface }}</strong>
                <span>字符 {{ mention.start }}–{{ mention.end }}</span>
                <ReviewBadge :status="mention.reviewStatus" />
              </router-link>
            </div>
            <p v-else class="muted">暂无已发布的原文提及。</p>
          </section>
        </main>

        <aside class="entity-sidebar">
          <section class="panel">
            <p class="section-kicker">别名与异名</p>
            <div v-if="profile.entity.aliases.length" class="tag-list">
              <span v-for="alias in profile.entity.aliases" :key="alias">{{
                alias
              }}</span>
            </div>
            <p v-else class="muted">暂无别名。</p>
          </section>

          <section class="panel">
            <p class="section-kicker">相关对象</p>
            <div v-if="profile.relatedEntities.length" class="related-list">
              <router-link
                v-for="entity in profile.relatedEntities"
                :key="entity.id"
                :to="`/entities/${entity.id}`"
              >
                <EntityTypeBadge :type="entity.type" />
                <strong>{{ entity.preferredName }}</strong>
              </router-link>
            </div>
            <p v-else class="muted">暂无已发布关联。</p>
          </section>
        </aside>
      </div>
    </template>
    <EmptyState
      v-else
      title="没有找到这个知识档案"
      description="实体可能尚未发布，或当前发布包中的引用已经失效。"
    />
  </section>
</template>
