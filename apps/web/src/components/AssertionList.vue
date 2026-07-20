<script setup lang="ts">
import {
  predicateDefinition,
  type Assertion,
  type Entity,
  type EntityId,
} from "@infinite-spacetime/contracts";
import { computed } from "vue";
import ReviewBadge from "./ReviewBadge.vue";

const props = defineProps<{
  assertions: readonly Assertion[];
  entities?: readonly Entity[];
  perspectiveEntityId?: EntityId;
}>();

const names = computed(
  () => new Map((props.entities ?? []).map((entity) => [entity.id, entity])),
);

function objectLabel(assertion: Assertion): string {
  const relatedId =
    props.perspectiveEntityId === assertion.objectId
      ? assertion.subjectId
      : assertion.objectId;
  if (assertion.literalValue) return assertion.literalValue;
  if (relatedId) {
    return names.value.get(relatedId)?.preferredName ?? relatedId;
  }
  return "未标明";
}

function predicateLabel(assertion: Assertion): string {
  const definition = predicateDefinition(assertion.predicate);
  if (props.perspectiveEntityId !== assertion.objectId) return definition.label;
  if (definition.directionality === "symmetric") return definition.label;
  return definition.inversePredicateId
    ? predicateDefinition(definition.inversePredicateId).label
    : `反向：${definition.label}`;
}
</script>

<template>
  <ol v-if="assertions.length" class="assertion-list">
    <li v-for="assertion in assertions" :key="assertion.id">
      <div class="assertion-line">
        <span class="predicate">{{ predicateLabel(assertion) }}</span>
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
