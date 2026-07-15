<script setup lang="ts">
import { kernel } from "./features";
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <router-link class="brand" to="/">
        <span class="brand-mark">志</span>
        <span>
          <strong>无限时空图</strong>
          <small>Infinite SpatioTemporal Map</small>
        </span>
      </router-link>

      <nav aria-label="主导航">
        <router-link
          v-for="feature in kernel.features"
          :key="feature.id"
          :to="feature.route"
        >
          {{ feature.navigation.label }}
        </router-link>
      </nav>
    </header>

    <main>
      <router-view />
    </main>
  </div>
</template>
