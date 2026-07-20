<script setup lang="ts">
import type {
  PassageAlignmentBatch,
  PassageAlignmentDecision,
  PassageAlignmentDecisionBundle,
  PassageAlignmentRelation,
  PassageAlignmentResolution,
  PassageAlignmentReviewStatus,
} from "@infinite-spacetime/contracts";
import { computed, ref, watch } from "vue";
import {
  decisionsBelongToBatch,
  isPassageAlignmentBatch,
  passageAlignmentStorageKey,
} from "./passage-alignment-batch";
import {
  decisionBundleMatchesScope,
  isDecisionBundle,
  mergeDecisionBundles,
} from "./decision-bundle";
import { downloadJson } from "./download-json";

const batch = ref<PassageAlignmentBatch>();
const selectedId = ref("");
const decisions = ref<Record<string, PassageAlignmentDecision>>({});
const resolution = ref<PassageAlignmentResolution>("accept");
const relation = ref<PassageAlignmentRelation>("equivalent");
const reviewStatus = ref<PassageAlignmentReviewStatus>("reviewed");
const leftIdsText = ref("");
const rightIdsText = ref("");
const reviewer = ref("");
const note = ref("");
const error = ref("");
const notice = ref("");
const selected = computed(() =>
  batch.value?.items.find((item) => item.id === selectedId.value),
);
const decidedCount = computed(() => Object.keys(decisions.value).length);
const leftPassages = computed(() => {
  const ids = new Set(parseIds(leftIdsText.value));
  return batch.value?.leftPassages.filter((item) => ids.has(item.id)) ?? [];
});
const rightPassages = computed(() => {
  const ids = new Set(parseIds(rightIdsText.value));
  return batch.value?.rightPassages.filter((item) => ids.has(item.id)) ?? [];
});

function batchKey(value: PassageAlignmentBatch) {
  return `${value.generatorId}:${value.generatedAt}`;
}
function persist(value: PassageAlignmentBatch) {
  localStorage.setItem(
    passageAlignmentStorageKey(value),
    JSON.stringify(Object.values(decisions.value)),
  );
}
function bundle(
  value: PassageAlignmentBatch,
  items: readonly PassageAlignmentDecision[],
  bundleId: string,
): PassageAlignmentDecisionBundle {
  return {
    version: 1,
    bundleId,
    workspace: "passage_alignment",
    publicationId: value.publicationId,
    baseContentChecksum: value.baseContentChecksum,
    batchKey: batchKey(value),
    createdAt:
      items
        .map((item) => item.decidedAt)
        .toSorted()
        .at(-1) ?? new Date().toISOString(),
    createdBy:
      [...new Set(items.map((item) => item.reviewer))].join("、") ||
      "unassigned",
    decisions: items,
  };
}

function parseIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

async function importBatch(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const value: unknown = JSON.parse(await file.text());
    if (!isPassageAlignmentBatch(value))
      throw new Error("文件不是有效的篇章对齐批次。");
    const saved = localStorage.getItem(passageAlignmentStorageKey(value));
    const savedDecisions: PassageAlignmentDecision[] = saved
      ? JSON.parse(saved)
      : [];
    if (!decisionsBelongToBatch(value, savedDecisions))
      throw new Error("本机保存的裁决不属于当前批次，请清理后重试。");
    batch.value = value;
    decisions.value = Object.fromEntries(
      savedDecisions.map((item) => [item.suggestionId, item]),
    );
    selectedId.value = value.items[0]?.id ?? "";
    notice.value = `已载入 ${value.items.length} 条篇章对齐建议。`;
    error.value = "";
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "篇章对齐批次读取失败";
  } finally {
    input.value = "";
  }
}

function saveDecision() {
  const item = selected.value;
  const value = batch.value;
  if (!item || !value) return;
  if (!reviewer.value.trim()) {
    error.value = "请填写裁决人。";
    return;
  }
  const leftPassageIds = parseIds(leftIdsText.value);
  const rightPassageIds = parseIds(rightIdsText.value);
  const allowedLeft = new Set(value.leftPassages.map((passage) => passage.id));
  const allowedRight = new Set(
    value.rightPassages.map((passage) => passage.id),
  );
  if (
    resolution.value !== "reject" &&
    (!leftPassageIds.length ||
      !rightPassageIds.length ||
      leftPassageIds.some((id) => !allowedLeft.has(id)) ||
      rightPassageIds.some((id) => !allowedRight.has(id)))
  ) {
    error.value = "两侧都必须填写当前版本内存在的段落 ID。";
    return;
  }
  const decision: PassageAlignmentDecision = {
    suggestionId: item.id,
    resolution: resolution.value,
    reviewStatus: reviewStatus.value,
    reviewer: reviewer.value.trim(),
    decidedAt: new Date().toISOString(),
    ...(resolution.value === "modify"
      ? {
          relation: relation.value,
          leftPassageIds,
          rightPassageIds,
        }
      : resolution.value === "accept" &&
          relation.value !== item.suggestedRelation
        ? { relation: relation.value }
        : {}),
    ...(note.value.trim() ? { note: note.value.trim() } : {}),
  };
  decisions.value = { ...decisions.value, [item.id]: decision };
  persist(value);
  notice.value = `已保存 ${item.id} 的人工裁决。`;
  error.value = "";
  selectedId.value =
    value.items.find((candidate) => !decisions.value[candidate.id])?.id ??
    item.id;
}

function exportDecisions() {
  const value = batch.value;
  if (!value) return;
  if (decidedCount.value !== value.items.length) {
    error.value = `还有 ${value.items.length - decidedCount.value} 条未裁决。`;
    return;
  }
  const ordered = value.items.map((item) => decisions.value[item.id]!);
  const exported = bundle(
    value,
    ordered,
    `passage:${value.publicationId}:${new Date().toISOString()}`,
  );
  downloadJson(
    exported,
    `${value.publicationId}.passage-alignment-bundle.json`,
  );
}
async function importDecisionBundle(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const value = batch.value;
  if (!file || !value) return;
  try {
    const imported: unknown = JSON.parse(await file.text());
    if (
      !isDecisionBundle(imported) ||
      imported.workspace !== "passage_alignment"
    )
      throw new Error("文件不是版本篇章对齐协作包。");
    if (
      !decisionBundleMatchesScope(imported, {
        workspace: "passage_alignment",
        publicationId: value.publicationId,
        baseContentChecksum: value.baseContentChecksum,
        batchKey: batchKey(value),
      })
    )
      throw new Error("协作包不属于当前发布版本或篇章对齐批次。");
    const current = Object.values(decisions.value);
    const result = mergeDecisionBundles(
      current.length
        ? [
            imported,
            bundle(
              value,
              current,
              `local:${value.publicationId}:${Date.now()}`,
            ),
          ]
        : [imported],
    );
    if (!result.bundle) {
      downloadJson(
        result.report,
        `${value.publicationId}.passage-alignment-conflicts.json`,
      );
      throw new Error(
        `发现 ${result.report.conflicts.length} 个实质冲突；当前进度未被覆盖，冲突报告已导出。`,
      );
    }
    decisions.value = Object.fromEntries(
      result.bundle.decisions.map((item) => [item.suggestionId, item]),
    );
    persist(value);
    notice.value = `已合并 ${result.report.mergedDecisionCount} 条篇章裁决。`;
    error.value = "";
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "协作包读取失败";
  } finally {
    input.value = "";
  }
}

watch(selected, (item) => {
  if (!item) return;
  const existing = decisions.value[item.id];
  resolution.value = existing?.resolution ?? "accept";
  relation.value = existing?.relation ?? item.suggestedRelation;
  reviewStatus.value = existing?.reviewStatus ?? "reviewed";
  leftIdsText.value = (existing?.leftPassageIds ?? item.leftPassageIds).join(
    ", ",
  );
  rightIdsText.value = (existing?.rightPassageIds ?? item.rightPassageIds).join(
    ", ",
  );
  reviewer.value = existing?.reviewer ?? reviewer.value;
  note.value = existing?.note ?? "";
});
</script>

<template>
  <section class="alignment-workspace">
    <div v-if="!batch" class="welcome-panel">
      <span>篇</span>
      <h2>版本篇章人工对齐</h2>
      <p>
        导入管线 <code>suggest-passage-alignments</code>
        生成的批次，核定一对一、一对多或多对多关系。
      </p>
      <label class="file-button standalone"
        >导入篇章对齐批次<input
          type="file"
          accept=".json"
          @change="importBatch"
      /></label>
    </div>
    <template v-else>
      <div class="alignment-toolbar">
        <div>
          <strong
            >{{ batch.leftEditionId }} ↔ {{ batch.rightEditionId }}</strong
          >
          <span>{{ decidedCount }}/{{ batch.items.length }} 已裁决</span>
        </div>
        <label class="file-button standalone"
          >更换批次<input type="file" accept=".json" @change="importBatch"
        /></label>
        <label class="file-button standalone"
          >合并协作包<input
            type="file"
            accept=".json"
            @change="importDecisionBundle"
        /></label>
        <button type="button" @click="exportDecisions">导出完整裁决</button>
      </div>
      <p v-if="error" class="message error">{{ error }}</p>
      <p v-else-if="notice" class="message notice">{{ notice }}</p>
      <div class="workspace alignment-grid">
        <aside class="queue-panel">
          <div class="candidate-list">
            <button
              v-for="item in batch.items"
              :key="item.id"
              type="button"
              :class="{
                active: item.id === selectedId,
                decided: decisions[item.id],
              }"
              @click="selectedId = item.id"
            >
              <span>{{ item.suggestedRelation }}</span>
              <strong>{{ item.leftPassageIds.join(" + ") }}</strong>
              <small
                >{{ decisions[item.id]?.resolution ?? "待裁决" }} ·
                {{ Math.round(item.confidence * 100) }}%</small
              >
            </button>
          </div>
        </aside>
        <section v-if="selected" class="review-panel alignment-review">
          <header>
            <div>
              <span>篇章关系建议</span>
              <h2>{{ selected.suggestedRelation }}</h2>
            </div>
            <span class="status-chip"
              >{{ Math.round(selected.confidence * 100) }}%</span
            >
          </header>
          <p>{{ selected.reasons.join("；") }}</p>
          <div class="passage-review-columns">
            <section>
              <h3>{{ batch.leftEditionId }}</h3>
              <label>段落 ID<input v-model="leftIdsText" type="text" /></label>
              <article v-for="passage in leftPassages" :key="passage.id">
                <small
                  >{{ passage.volumeLabel }} ·
                  {{ passage.sectionLabel ?? passage.id }}</small
                >
                <p>{{ passage.textOriginal }}</p>
              </article>
            </section>
            <section>
              <h3>{{ batch.rightEditionId }}</h3>
              <label>段落 ID<input v-model="rightIdsText" type="text" /></label>
              <article v-for="passage in rightPassages" :key="passage.id">
                <small
                  >{{ passage.volumeLabel }} ·
                  {{ passage.sectionLabel ?? passage.id }}</small
                >
                <p>{{ passage.textOriginal }}</p>
              </article>
            </section>
          </div>
          <div class="decision-form alignment-decision-form">
            <label
              ><span>裁决</span
              ><select v-model="resolution">
                <option value="accept">接受建议</option>
                <option value="modify">人工修订</option>
                <option value="reject">拒绝</option>
              </select></label
            >
            <label
              ><span>关系</span
              ><select v-model="relation">
                <option value="equivalent">内容等同</option>
                <option value="partial_overlap">部分重叠</option>
                <option value="reordered">次序调整</option>
                <option value="uncertain">尚不确定</option>
              </select></label
            >
            <label
              ><span>复核状态</span
              ><select v-model="reviewStatus">
                <option value="reviewed">已复核</option>
                <option value="verified">已核定</option>
                <option value="disputed">有争议</option>
              </select></label
            >
            <label
              ><span>裁决人</span><input v-model="reviewer" type="text"
            /></label>
            <label class="decision-note"
              ><span>说明</span><input v-model="note" type="text"
            /></label>
          </div>
          <footer>
            <button class="save-button" type="button" @click="saveDecision">
              保存并进入下一条
            </button>
          </footer>
        </section>
      </div>
    </template>
  </section>
</template>
