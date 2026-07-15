<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import DataBanner from "./components/DataBanner.vue";
import { useApplication } from "./composables/useApplication";
import { kernel } from "./features";

const router = useRouter();
const runtime = useApplication();
const query = ref("");
const menuOpen = ref(false);

function submitSearch() {
  const text = query.value.trim();
  void router.push({ path: "/search", query: text ? { q: text } : {} });
  menuOpen.value = false;
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <router-link class="brand" to="/" @click="menuOpen = false">
        <span class="brand-mark">志</span>
        <span>
          <strong>无限时空图</strong>
          <small>INFINITE SPATIOTEMPORAL MAP</small>
        </span>
      </router-link>

      <button
        class="menu-button"
        type="button"
        :aria-expanded="menuOpen"
        aria-label="打开主导航"
        @click="menuOpen = !menuOpen"
      >
        {{ menuOpen ? "收起" : "菜单" }}
      </button>

      <div class="topbar-tools" :class="{ 'topbar-tools--open': menuOpen }">
        <nav aria-label="主导航">
          <router-link
            v-for="feature in kernel.features"
            :key="feature.id"
            :to="feature.route"
            @click="menuOpen = false"
          >
            {{ feature.navigation.label }}
          </router-link>
        </nav>

        <form
          class="global-search"
          role="search"
          @submit.prevent="submitSearch"
        >
          <label class="sr-only" for="global-search">搜索全库</label>
          <input
            id="global-search"
            v-model="query"
            type="search"
            placeholder="搜索人物、地点、原文"
          />
          <button type="submit">检索</button>
        </form>
      </div>
    </header>

    <DataBanner />

    <main>
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <footer class="site-footer">
      <div>
        <strong>无限时空图</strong>
        <p>让每一条历史叙述都能回到原文、时代与地点。</p>
      </div>
      <div class="footer-meta">
        <span>{{ runtime.overview.manifest.title }}</span>
        <span>{{ runtime.overview.counts.passages }} 段原文</span>
        <router-link to="/data">数据与项目</router-link>
      </div>
    </footer>
  </div>
</template>
