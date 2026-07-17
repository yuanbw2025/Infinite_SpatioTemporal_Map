<script setup lang="ts">
import type {
  ResearchFindingKind,
  ResearchReport,
} from "@infinite-spacetime/contracts";
import { onMounted, ref } from "vue";
import EmptyState from "../../components/EmptyState.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/use-application";

const { services } = useApplication();
const report = ref<ResearchReport>();
const loading = ref(false);
const error = ref("");

const labels: Record<ResearchFindingKind, string> = {
  contradictory_assertions: "异文与矛盾",
  disputed_record: "争议记录",
  unresolved_geometry: "地点待定位",
  chronology_conflict: "纪年冲突",
};

async function load() {
  loading.value = true;
  error.value = "";
  try {
    report.value = await services.research.inspect({ limit: 500 });
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "研究线索加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="page content-page research-page">
    <PageHeader
      eyebrow="RESEARCH LAB"
      title="研究工具"
      description="自动发现值得人工复核的矛盾记载、争议关系、纪年倒置与未定位地点；系统只提出线索，不替史料下结论。"
    />

    <p v-if="loading" class="loading-line">正在检查跨文献线索……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <template v-else-if="report">
      <div class="research-summary">
        <article v-for="(label, kind) in labels" :key="kind" class="panel">
          <span>{{ label }}</span>
          <strong>{{ report.counts[kind] }}</strong>
        </article>
      </div>
      <div v-if="report.findings.length" class="research-findings">
        <article
          v-for="finding in report.findings"
          :key="finding.id"
          class="panel research-finding"
          :data-severity="finding.severity"
        >
          <div>
            <span>{{ labels[finding.kind] }}</span>
            <strong>{{ finding.severity }}</strong>
          </div>
          <h2>{{ finding.title }}</h2>
          <p>{{ finding.description }}</p>
          <footer>
            <router-link
              v-for="entityId in finding.entityIds"
              :key="entityId"
              :to="`/entities/${entityId}`"
              >查看实体</router-link
            >
            <router-link
              v-for="passageId in finding.passageIds"
              :key="passageId"
              :to="`/reader/${passageId}`"
              >核对原文</router-link
            >
          </footer>
        </article>
      </div>
      <EmptyState
        v-else
        title="当前发布包没有发现待核验线索"
        description="这不代表史料没有矛盾，只表示现有结构化数据尚未触发这些可解释规则。"
      />
    </template>
  </section>
</template>
