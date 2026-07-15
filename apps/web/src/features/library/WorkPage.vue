<script setup lang="ts">
import type {
  Edition,
  EditionId,
  Passage,
  Volume,
  VolumeId,
  Work,
  WorkId,
} from "@infinite-spacetime/contracts";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/useApplication";

const route = useRoute();
const { services } = useApplication();
const workId = route.params.workId as WorkId;
const work = ref<Work>();
const editions = ref<readonly Edition[]>([]);
const volumes = ref<readonly Volume[]>([]);
const passages = ref<readonly Passage[]>([]);
const selectedEditionId = ref<EditionId>();
const selectedVolumeId = ref<VolumeId>();
const loading = ref(true);
const error = ref("");
const nextCursor = ref<string>();
const selectedEdition = computed(() =>
  editions.value.find((edition) => edition.id === selectedEditionId.value),
);

async function loadVolumes() {
  if (!selectedEditionId.value) {
    volumes.value = [];
    selectedVolumeId.value = undefined;
    return;
  }
  volumes.value = await services.library.listVolumes(selectedEditionId.value);
  selectedVolumeId.value = volumes.value[0]?.id;
}

async function loadPassages(append = false) {
  if (!append) {
    passages.value = [];
    nextCursor.value = undefined;
  }
  const result = await services.reader.listPassages({
    workId,
    limit: 100,
    ...(append && nextCursor.value ? { cursor: nextCursor.value } : {}),
    ...(selectedEditionId.value ? { editionId: selectedEditionId.value } : {}),
    ...(selectedVolumeId.value ? { volumeId: selectedVolumeId.value } : {}),
  });
  passages.value = append ? [...passages.value, ...result.items] : result.items;
  nextCursor.value = result.nextCursor;
}

watch(selectedEditionId, async () => {
  await loadVolumes();
  if (!selectedVolumeId.value) await loadPassages();
});
watch(selectedVolumeId, () => loadPassages());

onMounted(async () => {
  try {
    const result = await services.library.openWork(workId);
    work.value = result.work;
    editions.value = result.editions;
    selectedEditionId.value = result.editions[0]?.id;
    if (!selectedEditionId.value) await loadPassages();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "方志加载失败";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="page content-page">
    <p v-if="loading" class="loading-line">正在展开方志结构……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <template v-else-if="work">
      <PageHeader
        eyebrow="WORK &amp; EDITIONS"
        :title="work.title"
        :description="work.abstract ?? '选择版本与卷章，进入可引用的原文段落。'"
      >
        <template #actions>
          <router-link class="text-link" to="/">← 返回书库</router-link>
        </template>
      </PageHeader>

      <div class="reader-filters">
        <label class="filter-field">
          <span>版本</span>
          <select v-model="selectedEditionId">
            <option v-if="!editions.length" :value="undefined">暂无版本</option>
            <option
              v-for="edition in editions"
              :key="edition.id"
              :value="edition.id"
            >
              {{ edition.label }}
            </option>
          </select>
        </label>
        <label class="filter-field">
          <span>卷章</span>
          <select v-model="selectedVolumeId">
            <option :value="undefined">全部卷章</option>
            <option
              v-for="volume in volumes"
              :key="volume.id"
              :value="volume.id"
            >
              {{ volume.label }}
            </option>
          </select>
        </label>
      </div>

      <aside v-if="selectedEdition" class="edition-provenance">
        <div>
          <span>版本说明</span>
          <strong>{{
            selectedEdition.publicationStatement ?? selectedEdition.label
          }}</strong>
        </div>
        <div v-if="selectedEdition.holdingInstitution">
          <span>收藏机构</span>
          <strong>{{ selectedEdition.holdingInstitution }}</strong>
        </div>
        <div v-if="selectedEdition.rightsStatement">
          <span>权利说明</span>
          <strong>{{ selectedEdition.rightsStatement }}</strong>
        </div>
        <a
          v-if="selectedEdition.sourceUrl"
          :href="selectedEdition.sourceUrl"
          target="_blank"
          rel="noreferrer"
          >查看来源</a
        >
      </aside>

      <template v-if="passages.length">
        <div class="passage-index">
          <router-link
            v-for="passage in passages"
            :key="passage.id"
            :to="`/reader/${passage.id}`"
          >
            <span>{{
              passage.source.sectionLabel ?? passage.source.volumeLabel
            }}</span>
            <p>
              {{ passage.text.original.slice(0, 96)
              }}{{ passage.text.original.length > 96 ? "…" : "" }}
            </p>
            <strong>阅读原文 →</strong>
          </router-link>
        </div>
        <button
          v-if="nextCursor"
          class="load-more-button"
          type="button"
          @click="loadPassages(true)"
        >
          载入更多段落
        </button>
      </template>
      <EmptyState
        v-else
        compact
        title="这一版本还没有段落"
        description="加入 passages 后，段落目录和阅读跳转会自动启用。"
      />
    </template>
  </section>
</template>
