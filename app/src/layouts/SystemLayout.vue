<script setup>
import { useRoute } from 'vue-router'
import { Map, BookOpen, Network, Library, Clock, Globe } from 'lucide-vue-next'

const route = useRoute()

const navItems = [
  { path: '/', name: '无限时空', icon: Globe },
  { path: '/library', name: '典籍书库', icon: Library },
  { path: '/wiki', name: '实体百科', icon: Map },
  { path: '/graph', name: '知识图谱', icon: Network },
  { path: '/timeline', name: '地铁时间轴', icon: Clock }
]
</script>

<template>
  <div class="system-layout">
    <!-- Premium Top Navigation -->
    <header class="top-nav">
      <div class="brand">
        <div class="seal">史</div>
        <div class="titles">
          <h1 class="font-scholar">无限时空图谱</h1>
          <span class="subtitle">Infinite SpatioTemporal Map</span>
        </div>
      </div>
      
      <nav class="nav-links">
        <router-link 
          v-for="item in navItems" 
          :key="item.path" 
          :to="item.path"
          class="nav-link"
          :class="{ active: route.path === item.path }"
        >
          <component :is="item.icon" class="icon" :size="18" />
          <span class="label">{{ item.name }}</span>
        </router-link>
      </nav>

      <div class="actions">
        <!-- Future user/settings/data status -->
        <div class="status-indicator">
          <span class="dot"></span>
          <span class="text">数据就绪</span>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.system-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: var(--color-parchment-base);
  overflow: hidden;
}

.top-nav {
  height: 64px;
  background: var(--color-parchment-dark);
  border-bottom: var(--border-ink);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.seal {
  width: 40px;
  height: 40px;
  background: var(--color-cinnabar);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-scholar);
  font-weight: bold;
  font-size: 24px;
  border-radius: 4px;
  box-shadow: 2px 2px 0 hsla(0, 0%, 0%, 0.2);
}

.titles h1 {
  font-size: 18px;
  margin: 0;
  color: var(--color-ink-deep);
  line-height: 1.2;
}

.subtitle {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-ink-faded);
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--color-ink-faded);
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  transition: var(--transition-smooth);
}

.nav-link:hover {
  background: var(--color-parchment-light);
  color: var(--color-cinnabar);
}

.nav-link.active {
  background: var(--color-parchment-base);
  color: var(--color-cinnabar);
  font-weight: bold;
  box-shadow: var(--shadow-inner);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-parchment-light);
  padding: 4px 12px;
  border-radius: 20px;
  border: var(--border-ink);
}

.dot {
  width: 6px;
  height: 6px;
  background: #4caf50;
  border-radius: 50%;
  box-shadow: 0 0 8px #4caf50;
}

.text {
  font-size: 11px;
  color: var(--color-ink-faded);
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
