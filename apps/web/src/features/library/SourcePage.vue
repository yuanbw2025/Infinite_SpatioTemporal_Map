<script setup lang="ts">
import type {
  SourceId,
  SourceProvenance,
  SourceRelation,
} from "@infinite-spacetime/contracts";
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import PageHeader from "../../components/PageHeader.vue";
import ReviewBadge from "../../components/ReviewBadge.vue";
import { useApplication } from "../../composables/use-application";

const relationLabels: Record<SourceRelation["relationType"], string> = {
  cites: "引用",
  derived_from: "派生自",
  edition_of: "版本源于",
  reproduces: "复制／重印",
  catalogues: "著录",
  digitizes: "数字化",
};
const route = useRoute();
const { services } = useApplication();
const provenance = ref<SourceProvenance>();
const loading = ref(true);
const error = ref("");

function sourceTitle(id: SourceId): string {
  return (
    provenance.value?.sources.find((source) => source.id === id)?.title ?? id
  );
}

onMounted(async () => {
  try {
    provenance.value = await services.provenance.openSource(
      route.params.sourceId as SourceId,
      2,
    );
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "来源链加载失败";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="page content-page">
    <p v-if="loading" class="loading-line">正在追溯来源链……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <template v-else-if="provenance">
      <PageHeader
        eyebrow="SOURCE PROVENANCE"
        :title="provenance.center.title"
        description="来源关系来自当前不可变发布包；箭头方向和审核依据均按契约保存，不由页面推断。"
      >
        <template #actions>
          <a
            v-if="provenance.center.url"
            class="text-link"
            :href="provenance.center.url"
            target="_blank"
            rel="noreferrer"
            >打开来源</a
          >
        </template>
      </PageHeader>

      <div class="content-grid">
        <article class="panel prose-panel">
          <p class="section-kicker">来源登记</p>
          <h2>{{ provenance.center.kind }}</h2>
          <p>{{ provenance.center.holdingInstitution ?? "未登记收藏机构" }}</p>
          <p>{{ provenance.center.rightsStatement }}</p>
          <code v-if="provenance.center.checksum">{{
            provenance.center.checksum
          }}</code>
        </article>
        <article class="panel prose-panel">
          <p class="section-kicker">引用范围</p>
          <h2>
            {{ provenance.works.length }} 部作品 ·
            {{ provenance.editions.length }} 个版本
          </h2>
          <router-link
            v-for="work in provenance.works"
            :key="work.id"
            class="text-link"
            :to="`/works/${work.id}`"
            >{{ work.title }}</router-link
          >
        </article>
      </div>

      <div v-if="provenance.relations.length" class="research-findings">
        <article
          v-for="relation in provenance.relations"
          :key="relation.id"
          class="panel research-finding"
        >
          <div>
            <span>{{ relationLabels[relation.relationType] }}</span>
            <ReviewBadge :status="relation.reviewStatus" />
          </div>
          <h2>
            <router-link :to="`/sources/${relation.subjectSourceId}`">{{
              sourceTitle(relation.subjectSourceId)
            }}</router-link>
            →
            <router-link :to="`/sources/${relation.objectSourceId}`">{{
              sourceTitle(relation.objectSourceId)
            }}</router-link>
          </h2>
          <p v-if="relation.note">{{ relation.note }}</p>
          <footer>
            <span
              v-for="reference in relation.sourceRefs"
              :key="`${reference.sourceId}:${reference.locator ?? ''}`"
            >
              {{ sourceTitle(reference.sourceId) }}
              <template v-if="reference.locator"
                >· {{ reference.locator }}</template
              >
            </span>
            <router-link
              v-for="span in relation.evidence"
              :key="`${span.passageId}:${span.start}`"
              :to="`/reader/${span.passageId}`"
              >核对原文</router-link
            >
          </footer>
        </article>
      </div>
      <EmptyState
        v-else
        title="该来源尚无已登记的来源关系"
        description="这表示当前数据尚未提供可审核关系，不代表它没有版本或引用历史。"
      />
    </template>
  </section>
</template>
