<script setup>
import SystemLayout from './layouts/SystemLayout.vue'
</script>

<template>
  <SystemLayout />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body, html, #app {
  width: 100%;
  height: 100%;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  background: #f5f0d6; /* 羊皮纸底色 */
  color: #2c2825; /* 墨汁黑字体 */
  overflow: hidden;
}
</style>
