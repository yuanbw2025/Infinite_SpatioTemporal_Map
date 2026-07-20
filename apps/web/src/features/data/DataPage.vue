<script setup lang="ts">
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/use-application";

const runtime = useApplication();
const counts = runtime.overview.counts;
const quality = runtime.overview.quality;

const metrics = [
  ["方志与文献", counts.works],
  ["版本", counts.editions],
  ["卷章", counts.volumes],
  ["原文段落", counts.passages],
  ["人工版本对齐", counts.passageAlignments],
  ["知识实体", counts.entities],
  ["实体提及", counts.mentions],
  ["证据主张", counts.assertions],
  ["历史地点", counts.places],
  ["时空经历", counts.occurrences],
] as const;

const coverage = [
  ["影印锚点", quality.coverage.facsimilePassages, counts.passages],
  ["简体文本层", quality.coverage.simplifiedPassages, counts.passages],
  ["白话文本层", quality.coverage.translatedPassages, counts.passages],
  ["主张证据", quality.coverage.evidencedAssertions, counts.assertions],
  ["主张纪年", quality.coverage.datedAssertions, counts.assertions],
  ["地点几何", quality.coverage.locatedPlaces, counts.places],
  ["经历纪年", quality.coverage.datedOccurrences, counts.occurrences],
] as const;

const reviewStatuses = [
  ["原始录入", "raw"],
  ["机器建议", "machine_suggested"],
  ["已复核", "reviewed"],
  ["已核定", "verified"],
  ["有争议", "disputed"],
  ["已驳回", "rejected"],
] as const;

const reviewTotal = Object.values(quality.reviewCounts).reduce(
  (sum, value) => sum + value,
  0,
);

function percentage(value: number, total: number): number {
  return total ? Math.round((value / total) * 100) : 0;
}
</script>

<template>
  <section class="page content-page">
    <PageHeader
      eyebrow="DATA &amp; PROVENANCE"
      title="数据与项目"
      description="当前站点读取一个版本化发布包。替换数据不会改变页面、领域规则和功能架构。"
    />

    <div class="metrics-grid">
      <article v-for="[label, value] in metrics" :key="label">
        <strong>{{ value.toLocaleString() }}</strong>
        <span>{{ label }}</span>
      </article>
    </div>

    <section class="data-quality-section">
      <div class="section-heading">
        <div>
          <p class="section-kicker">DATA QUALITY</p>
          <h2>覆盖度与审核状态</h2>
        </div>
        <p>
          这些数字直接从当前发布包计算，不以页面是否能显示作为“数据完成”的判断。
        </p>
      </div>
      <div class="quality-layout">
        <div class="coverage-grid">
          <article v-for="[label, value, total] in coverage" :key="label">
            <div>
              <strong>{{ label }}</strong>
              <span
                >{{ value }}/{{ total }} · {{ percentage(value, total) }}%</span
              >
            </div>
            <div class="quality-track">
              <i :style="{ width: `${percentage(value, total)}%` }"></i>
            </div>
          </article>
        </div>
        <article class="review-distribution">
          <h3>可审核记录</h3>
          <div
            v-for="[label, status] in reviewStatuses"
            :key="status"
            class="review-distribution-row"
          >
            <span>{{ label }}</span>
            <div class="quality-track">
              <i
                :class="`review-${status}`"
                :style="{
                  width: `${percentage(quality.reviewCounts[status], reviewTotal)}%`,
                }"
              ></i>
            </div>
            <strong>{{ quality.reviewCounts[status] }}</strong>
          </div>
        </article>
      </div>
    </section>

    <div class="content-grid">
      <article class="panel prose-panel">
        <p class="section-kicker">当前发布包</p>
        <h2>{{ runtime.overview.manifest.title }}</h2>
        <dl class="metadata-list">
          <div>
            <dt>发布 ID</dt>
            <dd>{{ runtime.overview.manifest.publicationId }}</dd>
          </div>
          <div>
            <dt>契约版本</dt>
            <dd>{{ runtime.overview.manifest.contractVersion }}</dd>
          </div>
          <div>
            <dt>生成时间</dt>
            <dd>{{ runtime.overview.manifest.generatedAt }}</dd>
          </div>
          <div>
            <dt>来源说明</dt>
            <dd>{{ runtime.overview.manifest.sourceDescription }}</dd>
          </div>
          <div>
            <dt>加载地址</dt>
            <dd>
              <code>{{ runtime.sourceUrl }}</code>
            </dd>
          </div>
        </dl>
      </article>

      <article class="panel prose-panel">
        <p class="section-kicker">接入原则</p>
        <h2>数据填入后，功能直接启用</h2>
        <ol class="steps-list">
          <li>数据管线输出符合 0.7.0 契约的 <code>publication.json</code>。</li>
          <li>将文件放到站点的 <code>public/data</code> 目录。</li>
          <li>书库、阅读、地图、人物、文博和检索自动消费同一发布包。</li>
          <li>任何实体和结论都应通过段落 ID 返回原文证据。</li>
        </ol>
      </article>
    </div>
  </section>
</template>
