import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '../stores/app'

const routes = [
  { path: '/', name: 'projects', component: () => import('../views/ProjectsView.vue') },
  { path: '/tasks', name: 'all-tasks', component: () => import('../views/AllTasksView.vue') },
  { path: '/project/:id', name: 'board', component: () => import('../views/BoardView.vue') },
  { path: '/report', name: 'report', component: () => import('../views/ReportView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.name === 'board') {
    const store = useAppStore()
    if (!store.projectById(to.params.id)) return { name: 'projects' }
  }
  return true
})

export default router
