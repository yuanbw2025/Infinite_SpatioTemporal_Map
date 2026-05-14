import { createRouter, createWebHistory } from 'vue-router'
import UnifiedView from '../views/UnifiedView.vue'

const routes = [
  {
    path: '/',
    name: 'Atlas',
    component: UnifiedView
  },
  {
    path: '/map',
    name: 'Map',
    component: () => import('../views/MapView.vue')
  },
  {
    path: '/library',
    name: 'Library',
    component: () => import('../views/LibraryView.vue')
  },
  {
    path: '/reader',
    name: 'Reader',
    component: () => import('../views/ReaderView.vue')
  },
  {
    path: '/wiki',
    name: 'Wiki',
    component: () => import('../views/WikiView.vue')
  },
  {
    path: '/graph',
    name: 'Graph',
    component: () => import('../views/GraphView.vue')
  },
  {
    path: '/timeline',
    name: 'Timeline',
    component: () => import('../views/TimelineView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
