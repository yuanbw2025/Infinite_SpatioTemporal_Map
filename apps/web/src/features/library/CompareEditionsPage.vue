<script setup lang="ts">
import type {
  Edition,
  EditionId,
  Passage,
  Work,
  WorkId,
} from "@infinite-spacetime/contracts";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/use-application";

interface ComparisonRow {
  readonly key: string;
  readonly left?: Passage;
  readonly right?: Passage;
  readonly label: string;
  readonly alignment: "label" | "sequence" | "unpaired";
}

const route = useRoute();
const { services } = useApplication();
const workId = route.params.workId as WorkId;
const work = ref<Work>();
const editions = ref<readonly Edition[]>([]);
const leftEditionId = ref<EditionId>();
const rightEditionId = ref<EditionId>();
const leftPassages = ref<readonly Passage[]>([]);
const rightPassages = ref<readonly Passage[]>([]);
const volumeLabels = ref<ReadonlyMap<string, string>>(new Map());
const loading = ref(true);
const comparing = ref(false);
const error = ref("");
let comparisonRequestId = 0;

function passageLabel(passage: Passage): string {
  return (
    passage.sectionLabel ??
    volumeLabels.value.get(passage.volumeId) ??
    "未命名卷章"
  );
}

function alignmentKey(passage: Passage): string {
  return passageLabel(passage).trim().toLocaleLowerCase();
}

const rows = computed<readonly ComparisonRow[]>(() => {
  const rightByLabel = new Map<string, Passage[]>();
  for (const passage of rightPassages.value) {
    const key = alignmentKey(passage);
    rightByLabel.set(key, [...(rightByLabel.get(key) ?? []), passage]);
  }
  const consumedRightIds = new Set<string>();
  const result: ComparisonRow[] = [];
  for (const left of leftPassages.value) {
    const key = alignmentKey(left);
    const sameLabel = rightByLabel
      .get(key)
      ?.find((passage) => !consumedRightIds.has(passage.id));
    const sameSequence = rightPassages.value.find(
      (passage) =>
        passage.sequence === left.sequence && !consumedRightIds.has(passage.id),
    );
    const right = sameLabel ?? sameSequence;
    if (right) consumedRightIds.add(right.id);
    result.push({
      key: `left-${left.id}`,
      left,
      ...(right ? { right } : {}),
      label: passageLabel(left),
      alignment: sameLabel ? "label" : right ? "sequence" : "unpaired",
    });
  }
  for (const right of rightPassages.value) {
    if (consumedRightIds.has(right.id)) continue;
    result.push({
      key: `right-${right.id}`,
      right,
      label: passageLabel(right),
      alignment: "unpaired",
    });
  }
  return result;
});

async function listAllPassages(editionId: EditionId): Promise<Passage[]> {
  const result: Passage[] = [];
  let cursor: string | undefined;
  do {
    const page = await services.reader.listPassages({
      workId,
      editionId,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    result.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return result;
}

async function compare() {
  const left = leftEditionId.value;
  const right = rightEditionId.value;
  if (!left || !right || left === right) {
    leftPassages.value = [];
    rightPassages.value = [];
    error.value = left === right ? "请选择两个不同版本。" : "请选择左右版本。";
    return;
  }
  const requestId = ++comparisonRequestId;
  comparing.value = true;
  error.value = "";
  try {
    const [nextLeft, nextRight] = await Promise.all([
      listAllPassages(left),
      listAllPassages(right),
    ]);
    if (requestId !== comparisonRequestId) return;
    leftPassages.value = nextLeft;
    rightPassages.value = nextRight;
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
    const editionVolumes = await Promise.all(
      result.editions.map((edition) =>
        services.library.listVolumes(edition.id),
      ),
    );
    volumeLabels.value = new Map(
      editionVolumes.flat().map((volume) => [volume.id, volume.label]),
    );
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
        description="按卷章标签优先、段落次序辅助排列两个版本；不自动消除异文，任何一侧都可回到原文详情。"
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
            </span>
          </header>
          <div class="edition-text-pair">
            <div :class="{ 'missing-edition-text': !row.left }">
              <template v-if="row.left">
                <p class="serif-snippet">{{ row.left.text.original }}</p>
                <router-link :to="`/reader/${row.left.id}`"
                  >打开左侧原文 →</router-link
                >
              </template>
              <span v-else>此侧暂无对应段落</span>
            </div>
            <div :class="{ 'missing-edition-text': !row.right }">
              <template v-if="row.right">
                <p class="serif-snippet">{{ row.right.text.original }}</p>
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
