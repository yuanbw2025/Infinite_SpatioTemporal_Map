<script setup lang="ts">
import type { Assertion, Entity } from "@infinite-spacetime/contracts";
import { computed } from "vue";
import ReviewBadge from "./ReviewBadge.vue";

const props = defineProps<{
  assertions: readonly Assertion[];
  entities?: readonly Entity[];
}>();

const names = computed(
  () => new Map((props.entities ?? []).map((entity) => [entity.id, entity])),
);

function objectLabel(assertion: Assertion): string {
  if (assertion.literalValue) return assertion.literalValue;
  if (assertion.objectId) {
    return (
      names.value.get(assertion.objectId)?.preferredName ?? assertion.objectId
    );
  }
  return "未标明";
}
</script>

<template>
  <ol v-if="assertions.length" class="assertion-list">
    <li v-for="assertion in assertions" :key="assertion.id">
      <div class="assertion-line">
        <span class="predicate">{{ assertion.predicate }}</span>
        <strong>{{ objectLabel(assertion) }}</strong>
        <ReviewBadge :status="assertion.reviewStatus" />
      </div>
      <p v-if="assertion.temporal" class="temporal-label">
        {{ assertion.temporal.original }}
      </p>
      <div class="evidence-links">
        <router-link
          v-for="(evidence, index) in assertion.evidence"
          :key="`${evidence.passageId}-${index}`"
          :to="`/reader/${evidence.passageId}`"
        >
          查看出处 {{ index + 1 }}
        </router-link>
      </div>
    </li>
  </ol>
  <p v-else class="muted">暂无已发布主张。</p>
</template>
