import { createRouter, createWebHistory } from 'vue-router'
import MapView from '../views/MapView.vue'

const routes = [
  {
    path: '/',
    redirect: '/map'
  },
  {
    path: '/map',
    name: 'Map',
    component: MapView
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
