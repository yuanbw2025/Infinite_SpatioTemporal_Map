<script setup lang="ts">
import type {
  FacsimileImageResource,
  PassageFacsimile,
} from "@infinite-spacetime/contracts";
import { computed, ref, watch } from "vue";
import { useApplication } from "../../../composables/use-application";
import FacsimileViewer from "./FacsimileViewer.vue";

const props = defineProps<{
  facsimiles: readonly PassageFacsimile[];
}>();
const { services } = useApplication();
const activeIndex = ref(0);
const resource = ref<FacsimileImageResource>();
const error = ref("");
let requestId = 0;

const active = computed(() => props.facsimiles[activeIndex.value]);

watch(
  () => props.facsimiles,
  () => {
    activeIndex.value = 0;
  },
);

watch(
  active,
  async (facsimile) => {
    const currentRequest = ++requestId;
    resource.value = undefined;
    error.value = "";
    if (!facsimile) return;
    try {
      const resolved = await services.reader.resolveFacsimile(facsimile.page);
      if (currentRequest === requestId) resource.value = resolved;
    } catch (reason) {
      if (currentRequest === requestId) {
        error.value =
          reason instanceof Error ? reason.message : "IIIF 影印解析失败";
      }
    }
  },
  { immediate: true },
);
</script>

<template>
  <section v-if="active" class="passage-facsimile">
    <nav
      v-if="facsimiles.length > 1"
      class="facsimile-page-nav"
      aria-label="本段关联影印页"
    >
      <button
        type="button"
        :disabled="activeIndex === 0"
        @click="activeIndex -= 1"
      >
        ← 上一页
      </button>
      <span>{{ activeIndex + 1 }} / {{ facsimiles.length }}</span>
      <button
        type="button"
        :disabled="activeIndex >= facsimiles.length - 1"
        @click="activeIndex += 1"
      >
        下一页 →
      </button>
    </nav>
    <FacsimileViewer
      :image-url="resource?.imageUrl"
      :image-service-info-url="resource?.imageService?.infoUrl"
      :canvas-url="active.page.canvasUrl"
      :page-label="active.page.label ?? `影印页 ${active.page.id}`"
      :region="active.anchor.region"
      :width="resource?.width ?? active.page.width"
      :height="resource?.height ?? active.page.height"
    />
    <p v-if="error" class="error-line">{{ error }}；仍可打开原始 IIIF 画布。</p>
  </section>
</template>

<style scoped>
.passage-facsimile {
  display: grid;
  gap: 10px;
}
.facsimile-page-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.facsimile-page-nav button {
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper-strong);
  cursor: pointer;
}
.facsimile-page-nav button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.facsimile-page-nav span {
  color: var(--muted);
  font-size: 12px;
}
</style>
