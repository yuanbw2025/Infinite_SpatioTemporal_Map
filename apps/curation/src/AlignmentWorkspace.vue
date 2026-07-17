<script setup lang="ts">
import type {
  AlignmentBatch,
  AlignmentDecision,
  AlignmentItem,
  AlignmentResolution,
} from "@infinite-spacetime/contracts";
import { computed, ref, watch } from "vue";

const batch = ref<AlignmentBatch>();
const selectedId = ref("");
const decisions = ref<Record<string, AlignmentDecision>>({});
const resolution = ref<AlignmentResolution>("create_new");
const targetId = ref("");
const reviewer = ref("");
const note = ref("");
const error = ref("");
const notice = ref("");
const selected = computed(() =>
  batch.value?.items.find((item) => item.id === selectedId.value),
);
const decidedCount = computed(() => Object.keys(decisions.value).length);

function valid(value: unknown): value is AlignmentBatch {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AlignmentBatch>;
  return (
    record.version === 1 &&
    typeof record.publicationId === "string" &&
    typeof record.alignerId === "string" &&
    Array.isArray(record.items) &&
    record.items.every(
      (item) =>
        item && typeof item.id === "string" && Array.isArray(item.matches),
    )
  );
}
function key(value: AlignmentBatch) {
  return `infinite-spacetime-alignment:${value.publicationId}:${value.generatedAt}`;
}
async function importBatch(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const value: unknown = JSON.parse(await file.text());
    if (!valid(value)) throw new Error("文件不是有效对齐批次。");
    if (new Set(value.items.map((item) => item.id)).size !== value.items.length)
      throw new Error("对齐批次包含重复 ID。");
    batch.value = value;
    const saved = localStorage.getItem(key(value));
    decisions.value = saved
      ? Object.fromEntries(
          (JSON.parse(saved) as AlignmentDecision[]).map((item) => [
            item.alignmentId,
            item,
          ]),
        )
      : {};
    selectedId.value = value.items[0]?.id ?? "";
    notice.value = `已载入 ${value.items.length} 条对齐任务。`;
    error.value = "";
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "对齐批次读取失败";
  } finally {
    input.value = "";
  }
}
function choose(item: AlignmentItem) {
  selectedId.value = item.id;
}
function saveDecision() {
  const item = selected.value;
  if (!item) return;
  if (!reviewer.value.trim()) {
    error.value = "请填写裁决人。";
    return;
  }
  if (
    resolution.value === "merge_existing" &&
    !item.matches.some((match) => match.targetId === targetId.value)
  ) {
    error.value = "合并时必须选择建议目标。";
    return;
  }
  const decision: AlignmentDecision = {
    alignmentId: item.id,
    resolution: resolution.value,
    reviewer: reviewer.value.trim(),
    decidedAt: new Date().toISOString(),
    ...(resolution.value === "merge_existing"
      ? { targetId: targetId.value }
      : {}),
    ...(note.value.trim() ? { note: note.value.trim() } : {}),
  };
  decisions.value = { ...decisions.value, [item.id]: decision };
  if (batch.value)
    localStorage.setItem(
      key(batch.value),
      JSON.stringify(Object.values(decisions.value)),
    );
  notice.value = `已保存“${item.sourceLabel}”的裁决。`;
  error.value = "";
  selectedId.value =
    batch.value?.items.find((candidate) => !decisions.value[candidate.id])
      ?.id ?? item.id;
}
function exportDecisions() {
  if (!batch.value) return;
  if (decidedCount.value !== batch.value.items.length) {
    error.value = `还有 ${batch.value.items.length - decidedCount.value} 条未裁决。`;
    return;
  }
  const value = batch.value.items.map((item) => decisions.value[item.id]!);
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(value, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${batch.value.publicationId}.alignment-decisions.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
watch(selected, (item) => {
  if (!item) return;
  const existing = decisions.value[item.id];
  resolution.value =
    existing?.resolution ??
    (item.suggestion === "manual_review" ? "keep_separate" : item.suggestion);
  targetId.value = existing?.targetId ?? item.matches[0]?.targetId ?? "";
  reviewer.value = existing?.reviewer ?? reviewer.value;
  note.value = existing?.note ?? "";
});
</script>

<template>
  <section class="alignment-workspace">
    <div v-if="!batch" class="welcome-panel">
      <span>合</span>
      <h2>实体与历史地点对齐</h2>
      <p>
        导入管线 <code>align</code> 生成的批次，人工决定合并、新建或保持分立。
      </p>
      <label class="file-button standalone"
        >导入对齐批次<input type="file" accept=".json" @change="importBatch"
      /></label>
    </div>
    <template v-else>
      <div class="alignment-toolbar">
        <div>
          <strong>{{ batch.publicationId }}</strong
          ><span>{{ decidedCount }}/{{ batch.items.length }} 已裁决</span>
        </div>
        <label class="file-button standalone"
          >更换批次<input type="file" accept=".json" @change="importBatch"
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
              @click="choose(item)"
            >
              <span>{{ item.kind }}</span
              ><strong>{{ item.sourceLabel }}</strong
              ><small>{{
                decisions[item.id]?.resolution ?? item.suggestion
              }}</small>
            </button>
          </div>
        </aside>
        <section v-if="selected" class="review-panel alignment-review">
          <header>
            <div>
              <span>{{ selected.kind }} ALIGNMENT</span>
              <h2>{{ selected.sourceLabel }}</h2>
            </div>
            <span class="status-chip">{{ selected.suggestion }}</span>
          </header>
          <div class="alignment-source">
            <h3>待对齐记录</h3>
            <pre>{{ JSON.stringify(selected.sourcePayload, null, 2) }}</pre>
          </div>
          <div class="alignment-matches">
            <h3>可能的既有记录</h3>
            <label v-for="match in selected.matches" :key="match.targetId">
              <input
                v-model="targetId"
                type="radio"
                :value="match.targetId"
              /><span
                ><strong>{{ match.label }}</strong
                ><small>{{ match.targetId }}</small
                ><em>{{ match.reasons.join("；") }}</em></span
              ><b>{{ Math.round(match.score * 100) }}%</b>
            </label>
            <p v-if="!selected.matches.length" class="missing-evidence">
              未找到候选，建议新建。
            </p>
          </div>
          <div class="decision-form alignment-decision-form">
            <label
              ><span>裁决</span
              ><select v-model="resolution">
                <option value="merge_existing">合入所选记录</option>
                <option value="create_new">新建独立记录</option>
                <option value="keep_separate">保持分立</option>
              </select></label
            >
            <label
              ><span>裁决人</span><input v-model="reviewer" type="text"
            /></label>
            <label
              ><span>说明</span
              ><input
                v-model="note"
                type="text"
                placeholder="同名不同人、沿革依据等"
            /></label>
          </div>
          <footer>
            <button class="save-button" type="button" @click="saveDecision">
              保存裁决并继续
            </button>
          </footer>
        </section>
      </div>
    </template>
  </section>
</template>
