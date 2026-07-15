<script setup lang="ts">
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/useApplication";

const runtime = useApplication();
const counts = runtime.overview.counts;

const metrics = [
  ["方志与文献", counts.works],
  ["版本", counts.editions],
  ["卷章", counts.volumes],
  ["原文段落", counts.passages],
  ["知识实体", counts.entities],
  ["实体提及", counts.mentions],
  ["证据主张", counts.assertions],
  ["历史地点", counts.places],
  ["时空经历", counts.occurrences],
] as const;
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
          <li>数据管线输出符合 0.3.0 契约的 <code>publication.json</code>。</li>
          <li>将文件放到站点的 <code>public/data</code> 目录。</li>
          <li>书库、阅读、地图、人物、文博和检索自动消费同一发布包。</li>
          <li>任何实体和结论都应通过段落 ID 返回原文证据。</li>
        </ol>
      </article>
    </div>
  </section>
</template>
