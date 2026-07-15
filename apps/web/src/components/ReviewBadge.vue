<script setup lang="ts">
import type { ReviewStatus } from "@infinite-spacetime/contracts";

defineProps<{ status: ReviewStatus }>();

const labels: Record<ReviewStatus, string> = {
  raw: "原始",
  machine_suggested: "机器候选",
  reviewed: "已审核",
  verified: "已核验",
  disputed: "有争议",
  rejected: "已拒绝",
};
</script>

<template>
  <span class="review-badge" :data-status="status">{{ labels[status] }}</span>
</template>
