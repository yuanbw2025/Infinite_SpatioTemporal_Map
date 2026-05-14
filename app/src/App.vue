<script setup>
import SystemLayout from './layouts/SystemLayout.vue'
</script>

<template>
  <SystemLayout />
</template>

<style>
:root {
  --color-parchment-base: #f5f0d6;
  --color-parchment-dark: #e8e0c0;
  --color-ink-deep: #2c2825;
  --color-ink-faded: #5c5346;
  --color-cinnabar: #8b0000;
  --color-gold: #c5a059;
  --font-scholar: 'Noto Serif SC', 'Source Han Serif SC', serif;
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --shadow-premium: 0 10px 30px rgba(0, 0, 0, 0.15);
  --texture-noise: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body, html, #app {
  width: 100%;
  height: 100%;
  font-family: var(--font-ui);
  background: var(--color-parchment-base);
  color: var(--color-ink-deep);
  overflow: hidden;
  position: relative;
}

body::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.05;
  pointer-events: none;
  z-index: 9999;
  background-image: var(--texture-noise);
}
</style>
