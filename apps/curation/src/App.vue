<script setup lang="ts">
import { ref } from "vue";
import AlignmentWorkspace from "./AlignmentWorkspace.vue";
import PassageAlignmentWorkspace from "./PassageAlignmentWorkspace.vue";
import { useCandidateReview } from "./use-candidate-review";

const workspaceMode = ref<"candidates" | "alignment" | "passage_alignment">(
  "candidates",
);
const {
  batch,
  selectedId,
  searchText,
  kindFilter,
  queueFilter,
  reviewer,
  decisionStatus,
  decisionNote,
  payloadText,
  decisions,
  error,
  notice,
  selected,
  candidateKinds,
  filteredCandidates,
  decidedCount,
  progress,
  importBatch,
  importPublication,
  importDecisionBundle,
  selectCandidate,
  saveDecision,
  revokeDecision,
  exportDecisions,
  evidenceOriginal,
} = useCandidateReview();
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
        <label v-if="batch" class="file-button secondary">
          合并协作包
          <input
            type="file"
            accept="application/json,.json"
            @change="importDecisionBundle"
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
      <button
        type="button"
        :class="{ active: workspaceMode === 'passage_alignment' }"
        @click="workspaceMode = 'passage_alignment'"
      >
        版本篇章对齐
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
    <AlignmentWorkspace v-else-if="workspaceMode === 'alignment'" />
    <PassageAlignmentWorkspace v-else />
  </div>
</template>
