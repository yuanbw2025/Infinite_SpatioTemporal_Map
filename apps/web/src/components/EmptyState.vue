<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description: string;
    compact?: boolean;
  }>(),
  { compact: false },
);
</script>

<template>
  <section class="empty-state" :class="{ 'empty-state--compact': compact }">
    <span class="empty-state__mark" aria-hidden="true">〇</span>
    <div>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
      <div v-if="$slots.default" class="empty-state__actions"><slot /></div>
    </div>
  </section>
</template>
