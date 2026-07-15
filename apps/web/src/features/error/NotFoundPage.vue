<script setup lang="ts">
import EmptyState from "../../components/EmptyState.vue";
</script>

<template>
  <section class="page content-page">
    <EmptyState
      title="这里没有对应的时空入口"
      description="地址可能已经改变，或相关数据尚未发布。可以返回方志书库重新开始探索。"
    >
      <router-link class="button-link" to="/">返回方志博览</router-link>
    </EmptyState>
  </section>
</template>
