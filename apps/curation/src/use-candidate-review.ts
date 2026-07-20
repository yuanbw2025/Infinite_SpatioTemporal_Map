import type {
  CandidateBatch,
  CandidateReviewDecision,
  CurationCandidate,
} from "@infinite-spacetime/contracts";
import { parseKnowledgePublication } from "@infinite-spacetime/contracts";
import { computed, ref, watch } from "vue";
import { candidateStorageKey, isCandidateBatch } from "./candidate-batch";

type DecisionStatus = CandidateReviewDecision["status"];

export function useCandidateReview() {
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

  const selected = computed(() =>
    batch.value?.candidates.find(
      (candidate) => candidate.id === selectedId.value,
    ),
  );
  const candidateKinds = computed(() => [
    ...new Set(
      batch.value?.candidates.map((candidate) => candidate.kind) ?? [],
    ),
  ]);
  const filteredCandidates = computed(() => {
    const term = searchText.value.trim().toLocaleLowerCase();
    return (batch.value?.candidates ?? []).filter((candidate) => {
      const decided = Boolean(decisions.value[candidate.id]);
      if (queueFilter.value === "pending" && decided) return false;
      if (queueFilter.value === "decided" && !decided) return false;
      if (kindFilter.value && candidate.kind !== kindFilter.value) return false;
      return (
        !term ||
        `${candidate.id} ${JSON.stringify(candidate.payload)}`
          .toLocaleLowerCase()
          .includes(term)
      );
    });
  });
  const decidedCount = computed(
    () =>
      batch.value?.candidates.filter(
        (candidate) => decisions.value[candidate.id],
      ).length ?? 0,
  );
  const progress = computed(() => {
    const total = batch.value?.candidates.length ?? 0;
    return total ? Math.round((decidedCount.value / total) * 100) : 0;
  });

  function persist(value: Record<string, CandidateReviewDecision>) {
    if (batch.value)
      localStorage.setItem(
        candidateStorageKey(batch.value),
        JSON.stringify(Object.values(value)),
      );
  }

  function loadSavedDecisions(value: CandidateBatch) {
    const saved = localStorage.getItem(candidateStorageKey(value));
    if (!saved) return void (decisions.value = {});
    try {
      const candidateIds = new Set(value.candidates.map((item) => item.id));
      decisions.value = Object.fromEntries(
        (JSON.parse(saved) as CandidateReviewDecision[])
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
      )
        throw new Error("已导入的发布包与候选批次 publicationId 不一致。");
      if (
        evidenceContentChecksum.value &&
        evidenceContentChecksum.value !== value.baseContentChecksum
      )
        throw new Error("候选批次不是从当前发布包版本中提取的。");
      const ids = value.candidates.map((candidate) => candidate.id);
      if (new Set(ids).size !== ids.length)
        throw new Error("候选批次包含重复 ID。");
      batch.value = value;
      loadSavedDecisions(value);
      selectedId.value = value.candidates[0]?.id ?? "";
      notice.value = `已载入 ${value.candidates.length} 条候选。`;
    } catch (reason) {
      error.value =
        reason instanceof Error ? reason.message : "候选批次读取失败";
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
        value.manifest.publicationId !== batch.value.publicationId
      )
        throw new Error("发布包与候选批次的 publicationId 不一致。");
      if (
        batch.value &&
        value.manifest.contentChecksum !== batch.value.baseContentChecksum
      )
        throw new Error("发布包版本与候选批次的来源校验和不一致。");
      passageTexts.value = Object.fromEntries(
        value.passages.map((passage) => [passage.id, passage.text.original]),
      );
      evidencePublicationId.value = value.manifest.publicationId;
      evidenceContentChecksum.value = value.manifest.contentChecksum;
      notice.value = `已载入 ${value.passages.length} 段原文证据。`;
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
    if (!reviewer.value.trim()) return void (error.value = "请填写审核人。");
    let correctedPayload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(payloadText.value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("修正内容必须是 JSON 对象。");
      correctedPayload = parsed as Record<string, unknown>;
    } catch (reason) {
      error.value =
        reason instanceof Error ? reason.message : "修正内容不是有效 JSON";
      return;
    }
    const decision: CandidateReviewDecision = {
      candidateId: candidate.id,
      status: decisionStatus.value,
      reviewer: reviewer.value.trim(),
      decidedAt: new Date().toISOString(),
      ...(decisionNote.value.trim() ? { note: decisionNote.value.trim() } : {}),
      ...(JSON.stringify(correctedPayload) !== JSON.stringify(candidate.payload)
        ? { correctedPayload }
        : {}),
    };
    decisions.value = { ...decisions.value, [candidate.id]: decision };
    persist(decisions.value);
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
    persist(next);
    notice.value = "已撤销本次工作台中的决策；原候选未被改动。";
  }

  function exportDecisions() {
    if (!batch.value) return;
    const ordered = batch.value.candidates
      .map((candidate) => decisions.value[candidate.id])
      .filter((decision): decision is CandidateReviewDecision =>
        Boolean(decision),
      );
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(ordered, null, 2)}\n`], {
        type: "application/json;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${batch.value.publicationId}.review-decisions.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notice.value = `已导出 ${ordered.length} 条决策。`;
  }

  const evidenceOriginal = (passageId: string) => passageTexts.value[passageId];

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
    if (!candidates.some((candidate) => candidate.id === selectedId.value))
      selectedId.value = candidates[0]?.id ?? "";
  });

  return {
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
    selectCandidate,
    saveDecision,
    revokeDecision,
    exportDecisions,
    evidenceOriginal,
  };
}
