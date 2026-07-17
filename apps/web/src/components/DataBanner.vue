<script setup lang="ts">
import { useApplication } from "../composables/use-application";

const runtime = useApplication();
</script>

<template>
  <aside
    v-if="runtime.status !== 'ready'"
    class="data-banner"
    :data-status="runtime.status"
  >
    <strong>{{
      runtime.status === "error" ? "数据包异常" : "空数据模式"
    }}</strong>
    <span>
      {{
        runtime.errorMessage ??
        "功能已经就绪；放入正式 publication.json 后即可浏览真实内容。"
      }}
    </span>
    <router-link to="/data">查看接入说明</router-link>
  </aside>
</template>
