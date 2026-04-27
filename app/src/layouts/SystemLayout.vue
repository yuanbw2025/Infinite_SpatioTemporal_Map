<script setup>
import { useRoute } from 'vue-router'
import { Map, BookOpen, Network, Library, Clock } from 'lucide-vue-next'

const route = useRoute()

const navItems = [
  { path: '/library', name: '典籍书库', icon: Library },
  { path: '/map', name: '时空沙盘', icon: Map },
  { path: '/reader', name: '典籍精读', icon: BookOpen },
  { path: '/wiki', name: '实体百科', icon: Library },
  { path: '/graph', name: '知识图谱', icon: Network },
  { path: '/timeline', name: '地铁时间轴', icon: Clock }
]
</script>

<template>
  <div class="system-layout">
    <!-- 侧边导航栏 -->
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-icon"></div>
      </div>
      <nav class="nav-menu">
        <router-link 
          v-for="item in navItems" 
          :key="item.path" 
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
        >
          <component :is="item.icon" class="icon" :size="20" />
          <span class="label">{{ item.name }}</span>
        </router-link>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view></router-view>
    </main>
  </div>
</template>

<style scoped>
.system-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  background-color: #f5f0d6;
  color: #2c2825;
  overflow: hidden;
}

.sidebar {
  width: 80px;
  background: #e8e0c0; /* 侧边栏略深的羊皮纸色 */
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  z-index: 100;
  transition: width 0.3s ease;
}

.logo {
  margin-bottom: 40px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #c93756, #8b0000); /* 中国红印章风格 */
  border-radius: 4px; /* 印章多为方正 */
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #5c5346; /* 淡墨色 */
  padding: 12px 0;
  position: relative;
  transition: all 0.2s;
}

.nav-item:hover {
  color: #8b0000; /* 悬停时朱砂红 */
}

.nav-item.active {
  color: #8b0000; /* 选中时朱砂红 */
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10%;
  height: 80%;
  width: 3px;
  background: #8b0000;
  border-radius: 0 4px 4px 0;
}

.icon {
  margin-bottom: 4px;
}

.label {
  font-size: 11px;
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
