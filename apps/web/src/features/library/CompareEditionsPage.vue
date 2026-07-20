<script setup lang="ts">
import type {
  Edition,
  EditionComparisonRow,
  EditionId,
  Work,
  WorkId,
} from "@infinite-spacetime/contracts";
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/use-application";

const route = useRoute();
const { services } = useApplication();
const workId = route.params.workId as WorkId;
const work = ref<Work>();
const editions = ref<readonly Edition[]>([]);
const leftEditionId = ref<EditionId>();
const rightEditionId = ref<EditionId>();
const rows = ref<readonly EditionComparisonRow[]>([]);
const loading = ref(true);
const comparing = ref(false);
const error = ref("");
let comparisonRequestId = 0;

function similarityLabel(row: EditionComparisonRow): string | undefined {
  return row.difference
    ? `文本相似 ${Math.round(row.difference.similarity * 100)}%`
    : undefined;
}

async function compare() {
  const left = leftEditionId.value;
  const right = rightEditionId.value;
  if (!left || !right || left === right) {
    rows.value = [];
    error.value = left === right ? "请选择两个不同版本。" : "请选择左右版本。";
    return;
  }
  const requestId = ++comparisonRequestId;
  comparing.value = true;
  error.value = "";
  try {
    const result = await services.reader.compareEditions({
      workId,
      leftEditionId: left,
      rightEditionId: right,
    });
    if (requestId !== comparisonRequestId) return;
    rows.value = result.rows;
  } catch (reason) {
    if (requestId === comparisonRequestId) {
      error.value =
        reason instanceof Error ? reason.message : "版本对读加载失败";
    }
  } finally {
    if (requestId === comparisonRequestId) comparing.value = false;
  }
}

watch([leftEditionId, rightEditionId], () => void compare());

onMounted(async () => {
  try {
    const result = await services.library.openWork(workId);
    work.value = result.work;
    editions.value = result.editions;
    leftEditionId.value = result.editions[0]?.id;
    rightEditionId.value = result.editions[1]?.id;
    if (result.editions.length < 2) {
      error.value = "版本对读至少需要两个版本。";
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "书目加载失败";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="page content-page edition-compare-page">
    <p v-if="loading" class="loading-line">正在读取版本信息……</p>
    <template v-else-if="work">
      <PageHeader
        eyebrow="EDITION COMPARISON"
        :title="`${work.title} · 版本对读`"
        description="按卷章与段落次序排列版本，逐字标示增删异文；自动配对只用于阅读辅助，不代替人工校定。"
      >
        <template #actions>
          <router-link class="text-link" :to="`/works/${workId}`"
            >← 返回书目</router-link
          >
        </template>
      </PageHeader>

      <div class="edition-compare-controls">
        <label class="filter-field">
          <span>左侧版本</span>
          <select v-model="leftEditionId">
            <option
              v-for="edition in editions"
              :key="edition.id"
              :value="edition.id"
            >
              {{ edition.label }}
            </option>
          </select>
        </label>
        <span class="compare-mark">⇄</span>
        <label class="filter-field">
          <span>右侧版本</span>
          <select v-model="rightEditionId">
            <option
              v-for="edition in editions"
              :key="edition.id"
              :value="edition.id"
            >
              {{ edition.label }}
            </option>
          </select>
        </label>
      </div>

      <p v-if="comparing" class="loading-line">正在排列两个版本……</p>
      <p v-else-if="error" class="error-line">{{ error }}</p>
      <div v-else-if="rows.length" class="edition-comparison">
        <article
          v-for="row in rows"
          :key="row.key"
          class="edition-comparison-row"
        >
          <header>
            <strong>{{ row.label }}</strong>
            <span>
              {{
                row.alignment === "label"
                  ? "同名卷章"
                  : row.alignment === "sequence"
                    ? "按次序暂配"
                    : "单侧段落"
              }}
              <template v-if="similarityLabel(row)">
                · {{ similarityLabel(row) }}</template
              >
              <template v-if="row.difference?.isCoarse">
                · 长段粗略比较</template
              >
            </span>
          </header>
          <div class="edition-text-pair">
            <div :class="{ 'missing-edition-text': !row.left }">
              <template v-if="row.left">
                <p class="serif-snippet">
                  <template v-if="row.difference">
                    <span
                      v-for="(segment, index) in row.difference.left"
                      :key="`left-${index}`"
                      :class="{
                        'edition-diff--removed': segment.kind === 'removed',
                      }"
                      >{{ segment.text }}</span
                    >
                  </template>
                  <template v-else>{{ row.left.text.original }}</template>
                </p>
                <router-link :to="`/reader/${row.left.id}`"
                  >打开左侧原文 →</router-link
                >
              </template>
              <span v-else>此侧暂无对应段落</span>
            </div>
            <div :class="{ 'missing-edition-text': !row.right }">
              <template v-if="row.right">
                <p class="serif-snippet">
                  <template v-if="row.difference">
                    <span
                      v-for="(segment, index) in row.difference.right"
                      :key="`right-${index}`"
                      :class="{
                        'edition-diff--inserted': segment.kind === 'inserted',
                      }"
                      >{{ segment.text }}</span
                    >
                  </template>
                  <template v-else>{{ row.right.text.original }}</template>
                </p>
                <router-link :to="`/reader/${row.right.id}`"
                  >打开右侧原文 →</router-link
                >
              </template>
              <span v-else>此侧暂无对应段落</span>
            </div>
          </div>
        </article>
      </div>
      <EmptyState
        v-else
        compact
        title="还没有可对读的段落"
        description="为两个版本接入 passages 后，对读表会自动生成。"
      />
    </template>
    <p v-else-if="error" class="error-line">{{ error }}</p>
  </section>
</template>

<style scoped>
.edition-diff--removed,
.edition-diff--inserted {
  padding: 1px 2px;
  border-radius: 3px;
}
.edition-diff--removed {
  color: #8a352d;
  background: #f9ded9;
  text-decoration: line-through;
}
.edition-diff--inserted {
  color: #245f43;
  background: #dcefe3;
  text-decoration: underline;
  text-decoration-thickness: 2px;
}
</style>
