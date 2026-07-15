<script setup lang="ts">
import type { EntityType } from "@infinite-spacetime/contracts";

defineProps<{ type: EntityType }>();

const labels: Record<EntityType, string> = {
  person: "人物",
  place: "地点",
  time: "时间",
  office: "官职",
  institution: "机构",
  event: "事件",
  artifact: "文物",
  site: "遗址",
  material: "材料",
  technique: "工艺",
  motif: "纹样",
  inscription: "铭文",
};
</script>

<template>
  <span class="type-badge" :data-type="type">{{ labels[type] }}</span>
</template>
