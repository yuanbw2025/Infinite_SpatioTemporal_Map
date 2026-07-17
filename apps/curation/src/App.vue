<script setup lang="ts">
import type {
  CandidateBatch,
  CandidateReviewDecision,
  CurationCandidate,
} from "@infinite-spacetime/contracts";
import { parseKnowledgePublication } from "@infinite-spacetime/contracts";
import { computed, ref, watch } from "vue";
import AlignmentWorkspace from "./AlignmentWorkspace.vue";
import { candidateStorageKey, isCandidateBatch } from "./candidate-batch";

type DecisionStatus = CandidateReviewDecision["status"];

const batch = ref<CandidateBatch>();
const passageTexts = ref<Record<string, string>>({});
const evidencePublicationId = ref("");
const evidenceContentChecksum = ref("");
const selectedId = ref("");
const searchText = ref("");
const kindFilter = ref("");
const queueFilter = ref<"all" | "pending" | "decided">("pending");
const reviewer = ref("");
const decisionStatus = ref<DecisionStatus>("verified");
const decisionNote = ref("");
const payloadText = ref("");
const decisions = ref<Record<string, CandidateReviewDecision>>({});
const error = ref("");
const notice = ref("");
const workspaceMode = ref<"candidates" | "alignment">("candidates");

const selected = computed(() =>
  batch.value?.candidates.find(
    (candidate) => candidate.id === selectedId.value,
  ),
);

const candidateKinds = computed(() => [
  ...new Set(batch.value?.candidates.map((candidate) => candidate.kind) ?? []),
]);

const filteredCandidates = computed(() => {
  const term = searchText.value.trim().toLocaleLowerCase();
  return (batch.value?.candidates ?? []).filter((candidate) => {
    const decided = Boolean(decisions.value[candidate.id]);
    if (queueFilter.value === "pending" && decided) return false;
    if (queueFilter.value === "decided" && !decided) return false;
    if (kindFilter.value && candidate.kind !== kindFilter.value) return false;
    if (!term) return true;
    return `${candidate.id} ${JSON.stringify(candidate.payload)}`
      .toLocaleLowerCase()
      .includes(term);
  });
});

const decidedCount = computed(() =>
  batch.value
    ? batch.value.candidates.filter(
        (candidate) => decisions.value[candidate.id],
      ).length
    : 0,
);

const progress = computed(() => {
  const total = batch.value?.candidates.length ?? 0;
  return total ? Math.round((decidedCount.value / total) * 100) : 0;
});

function loadSavedDecisions(value: CandidateBatch) {
  const saved = localStorage.getItem(candidateStorageKey(value));
  if (!saved) {
    decisions.value = {};
    return;
  }
  try {
    const parsed = JSON.parse(saved) as CandidateReviewDecision[];
    const candidateIds = new Set(
      value.candidates.map((candidate) => candidate.id),
    );
    decisions.value = Object.fromEntries(
      parsed
        .filter((decision) => candidateIds.has(decision.candidateId))
        .map((decision) => [decision.candidateId, decision]),
    );
  } catch {
    decisions.value = {};
    error.value = "本地保存的审核进度损坏，已忽略。";
  }
}

async function importBatch(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = "";
  notice.value = "";
  try {
    const value: unknown = JSON.parse(await file.text());
    if (!isCandidateBatch(value)) throw new Error("文件不是有效候选批次。");
    if (
      evidencePublicationId.value &&
      evidencePublicationId.value !== value.publicationId
    ) {
      throw new Error("已导入的发布包与候选批次 publicationId 不一致。");
    }
    if (
      evidenceContentChecksum.value &&
      evidenceContentChecksum.value !== value.baseContentChecksum
    ) {
      throw new Error("候选批次不是从当前发布包版本中提取的。");
    }
    const ids = value.candidates.map((candidate) => candidate.id);
    if (new Set(ids).size !== ids.length)
      throw new Error("候选批次包含重复 ID。");
    batch.value = value;
    loadSavedDecisions(value);
    selectedId.value = value.candidates[0]?.id ?? "";
    notice.value = `已载入 ${value.candidates.length} 条候选。`;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "候选批次读取失败";
  } finally {
    input.value = "";
  }
}

async function importPublication(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = "";
  try {
    const value = parseKnowledgePublication(JSON.parse(await file.text()));
    if (
      batch.value &&
      value.manifest?.publicationId !== batch.value.publicationId
    ) {
      throw new Error("发布包与候选批次的 publicationId 不一致。 ");
    }
    if (
      batch.value &&
      value.manifest.contentChecksum !== batch.value.baseContentChecksum
    ) {
      throw new Error("发布包版本与候选批次的来源校验和不一致。 ");
    }
    const entries: [string, string][] = [];
    for (const passage of value.passages) {
      if (!passage || typeof passage !== "object") continue;
      const record = passage as {
        id?: unknown;
        text?: { original?: unknown };
      };
      if (
        typeof record.id === "string" &&
        typeof record.text?.original === "string"
      ) {
        entries.push([record.id, record.text.original]);
      }
    }
    passageTexts.value = Object.fromEntries(entries);
    evidencePublicationId.value = value.manifest.publicationId;
    evidenceContentChecksum.value = value.manifest.contentChecksum;
    notice.value = `已载入 ${entries.length} 段原文证据。`;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "发布包读取失败";
  } finally {
    input.value = "";
  }
}

function selectCandidate(candidate: CurationCandidate) {
  selectedId.value = candidate.id;
}

function saveDecision() {
  const candidate = selected.value;
  if (!candidate) return;
  error.value = "";
  notice.value = "";
  if (!reviewer.value.trim()) {
    error.value = "请填写审核人。";
    return;
  }
  let correctedPayload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(payloadText.value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("修正内容必须是 JSON 对象。");
    }
    correctedPayload = parsed as Record<string, unknown>;
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "修正内容不是有效 JSON";
    return;
  }
  const changed =
    JSON.stringify(correctedPayload) !== JSON.stringify(candidate.payload);
  const decision: CandidateReviewDecision = {
    candidateId: candidate.id,
    status: decisionStatus.value,
    reviewer: reviewer.value.trim(),
    decidedAt: new Date().toISOString(),
    ...(decisionNote.value.trim() ? { note: decisionNote.value.trim() } : {}),
    ...(changed ? { correctedPayload } : {}),
  };
  decisions.value = { ...decisions.value, [candidate.id]: decision };
  if (batch.value) {
    localStorage.setItem(
      candidateStorageKey(batch.value),
      JSON.stringify(Object.values(decisions.value)),
    );
  }
  notice.value = `已保存 ${candidate.id} 的审核决策。`;
  const next = filteredCandidates.value.find(
    (item) => item.id !== candidate.id,
  );
  if (queueFilter.value === "pending" && next) selectedId.value = next.id;
}

function revokeDecision() {
  const candidate = selected.value;
  if (!candidate || !decisions.value[candidate.id]) return;
  const next = { ...decisions.value };
  delete next[candidate.id];
  decisions.value = next;
  if (batch.value) {
    localStorage.setItem(
      candidateStorageKey(batch.value),
      JSON.stringify(Object.values(next)),
    );
  }
  notice.value = "已撤销本次工作台中的决策；原候选未被改动。";
}

function exportDecisions() {
  if (!batch.value) return;
  const ordered = batch.value.candidates
    .map((candidate) => decisions.value[candidate.id])
    .filter((decision): decision is CandidateReviewDecision =>
      Boolean(decision),
    );
  const blob = new Blob([`${JSON.stringify(ordered, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${batch.value.publicationId}.review-decisions.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  notice.value = `已导出 ${ordered.length} 条决策。`;
}

function evidenceOriginal(passageId: string): string | undefined {
  return passageTexts.value[passageId];
}

watch(selected, (candidate) => {
  if (!candidate) return;
  const existing = decisions.value[candidate.id];
  reviewer.value = existing?.reviewer ?? reviewer.value;
  decisionStatus.value = existing?.status ?? "verified";
  decisionNote.value = existing?.note ?? "";
  payloadText.value = JSON.stringify(
    existing?.correctedPayload ?? candidate.payload,
    null,
    2,
  );
});

watch(filteredCandidates, (candidates) => {
  if (!candidates.some((candidate) => candidate.id === selectedId.value)) {
    selectedId.value = candidates[0]?.id ?? "";
  }
});
</script>

<template>
  <div class="curation-shell" @keydown.ctrl.enter.prevent="saveDecision">
    <header class="curation-header">
      <div>
        <p>INFINITE SPATIOTEMPORAL MAP</p>
        <h1>数据审核工作台</h1>
        <span>本地优先 · 追加式决策 · 不直接修改正式发布包</span>
      </div>
      <div class="import-actions">
        <label class="file-button">
          导入候选批次
          <input
            type="file"
            accept="application/json,.json"
            @change="importBatch"
          />
        </label>
        <label class="file-button secondary">
          导入发布包原文
          <input
            type="file"
            accept="application/json,.json"
            @change="importPublication"
          />
        </label>
        <button
          type="button"
          :disabled="!decidedCount"
          @click="exportDecisions"
        >
          导出决策
        </button>
      </div>
    </header>

    <nav class="workspace-mode-switch" aria-label="审核工作类型">
      <button
        type="button"
        :class="{ active: workspaceMode === 'candidates' }"
        @click="workspaceMode = 'candidates'"
      >
        知识候选审核
      </button>
      <button
        type="button"
        :class="{ active: workspaceMode === 'alignment' }"
        @click="workspaceMode = 'alignment'"
      >
        实体与地点对齐
      </button>
    </nav>

    <template v-if="workspaceMode === 'candidates'">
      <p v-if="error" class="message error">{{ error }}</p>
      <p v-else-if="notice" class="message notice">{{ notice }}</p>

      <section v-if="batch" class="batch-summary">
        <div>
          <span>发布批次</span><strong>{{ batch.publicationId }}</strong>
        </div>
        <div>
          <span>提取器</span><strong>{{ batch.generatorId }}</strong>
        </div>
        <div>
          <span>审核进度</span
          ><strong>{{ decidedCount }}/{{ batch.candidates.length }}</strong>
        </div>
        <div class="progress-track">
          <i :style="{ width: `${progress}%` }"></i>
        </div>
      </section>

      <main v-if="batch" class="workspace">
        <aside class="queue-panel">
          <div class="queue-filters">
            <input
              v-model="searchText"
              type="search"
              placeholder="搜索候选 ID 或内容"
            />
            <select v-model="kindFilter">
              <option value="">全部类型</option>
              <option v-for="kind in candidateKinds" :key="kind" :value="kind">
                {{ kind }}
              </option>
            </select>
            <select v-model="queueFilter">
              <option value="pending">未处理</option>
              <option value="decided">已处理</option>
              <option value="all">全部</option>
            </select>
          </div>
          <div class="candidate-list">
            <button
              v-for="candidate in filteredCandidates"
              :key="candidate.id"
              type="button"
              :class="{
                active: candidate.id === selectedId,
                decided: decisions[candidate.id],
              }"
              @click="selectCandidate(candidate)"
            >
              <span>{{ candidate.kind }}</span>
              <strong>{{ candidate.id }}</strong>
              <small>
                {{ decisions[candidate.id]?.status ?? candidate.status }}
                <template v-if="candidate.confidence !== undefined">
                  · {{ Math.round(candidate.confidence * 100) }}%
                </template>
              </small>
            </button>
            <p v-if="!filteredCandidates.length" class="empty-queue">
              当前筛选下没有候选。
            </p>
          </div>
        </aside>

        <section v-if="selected" class="review-panel">
          <header>
            <div>
              <span>{{ selected.kind }}</span>
              <h2>{{ selected.id }}</h2>
            </div>
            <span class="status-chip">{{ selected.status }}</span>
          </header>

          <section class="evidence-section">
            <h3>原文证据</h3>
            <article
              v-for="span in selected.evidence"
              :key="`${span.passageId}-${span.start}`"
            >
              <div>
                <strong>{{ span.passageId }}</strong>
                <span>{{ span.start }}–{{ span.end }}</span>
              </div>
              <template v-if="evidenceOriginal(span.passageId)">
                <p class="evidence-context">
                  {{
                    evidenceOriginal(span.passageId)?.slice(
                      Math.max(0, span.start - 36),
                      span.start,
                    )
                  }}<mark>{{
                    evidenceOriginal(span.passageId)?.slice(
                      span.start,
                      span.end,
                    )
                  }}</mark
                  >{{
                    evidenceOriginal(span.passageId)?.slice(
                      span.end,
                      span.end + 36,
                    )
                  }}
                </p>
              </template>
              <p v-else class="missing-evidence">
                导入对应发布包后显示原文上下文。
              </p>
              <small v-if="span.note">{{ span.note }}</small>
            </article>
          </section>

          <label class="payload-editor">
            <span>候选内容 / 人工修正</span>
            <textarea v-model="payloadText" spellcheck="false"></textarea>
          </label>

          <div class="decision-form">
            <label>
              <span>审核结果</span>
              <select v-model="decisionStatus">
                <option value="verified">核定</option>
                <option value="reviewed">已复核</option>
                <option value="disputed">有争议</option>
                <option value="rejected">驳回</option>
              </select>
            </label>
            <label>
              <span>审核人</span>
              <input
                v-model="reviewer"
                type="text"
                placeholder="姓名或团队标识"
              />
            </label>
            <label class="decision-note">
              <span>审核说明</span>
              <input
                v-model="decisionNote"
                type="text"
                placeholder="核对依据、争议点或修正原因"
              />
            </label>
          </div>

          <footer>
            <button
              v-if="decisions[selected.id]"
              class="danger-button"
              type="button"
              @click="revokeDecision"
            >
              撤销当前决策
            </button>
            <button class="save-button" type="button" @click="saveDecision">
              保存并进入下一条 <kbd>⌃ Enter</kbd>
            </button>
          </footer>
        </section>
        <section v-else class="review-panel empty-review">
          请选择一个候选。
        </section>
      </main>

      <section v-else class="welcome-panel">
        <span>审</span>
        <h2>从候选批次开始</h2>
        <p>
          先运行管线的 <code>candidates</code> 命令，再把生成的 JSON
          导入这里。审核进度只保存在本机浏览器。
        </p>
      </section>
    </template>
    <AlignmentWorkspace v-else />
  </div>
</template>
