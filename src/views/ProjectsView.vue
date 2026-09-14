<script setup>
import { computed, ref } from 'vue'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'
import ProjectModal from '../components/ProjectModal.vue'
import AppIcon from '../components/AppIcon.vue'
import { formatDuration } from '../utils/time'

const store = useAppStore()
const auth = useAuthStore()

const showAdd = ref(false)
const editing = ref(null)

const stats = computed(() => {
  const map = {}
  for (const t of store.tasks) {
    if (!map[t.projectId]) map[t.projectId] = { total: 0, done: 0, seconds: 0 }
    map[t.projectId].total += 1
    if (t.status === 'done') map[t.projectId].done += 1
    map[t.projectId].seconds += t.totalTimeSeconds || 0
  }
  return map
})

function stat(projectId) {
  return stats.value[projectId] || { total: 0, done: 0, seconds: 0 }
}
</script>

<template>
  <div class="projects-layout">
    <aside class="sidebar">
      <h2 class="sidebar__title">Проекты</h2>
      <ul class="sidebar__list">
        <li v-for="p in store.projects" :key="p.id" class="sidebar__row">
          <RouterLink :to="`/project/${p.id}`" class="sidebar__link">
            <span>{{ p.name }}</span>
            <span class="sidebar__rate">{{ p.hourlyRate }} ₽/ч</span>
          </RouterLink>
          <button
            v-if="auth.isAdmin"
            type="button"
            class="icon-btn"
            :aria-label="`Редактировать проект «${p.name}»`"
            title="Редактировать проект"
            @click="editing = p"
          >
            <AppIcon name="pencil" :size="14" />
          </button>
        </li>
      </ul>
      <button
        v-if="auth.isAdmin"
        type="button"
        class="btn btn-primary sidebar__add"
        @click="showAdd = true"
      >
        <AppIcon name="plus" :size="14" />
        Добавить проект
      </button>
    </aside>

    <main class="projects-main">
      <h1 class="page-title">Проекты</h1>

      <p v-if="!store.projects.length" class="empty-state">
        {{ auth.isAdmin ? 'Добавьте первый проект' : 'Проектов пока нет' }}
      </p>
      <div v-else class="grid">
        <RouterLink
          v-for="p in store.projects"
          :key="p.id"
          :to="`/project/${p.id}`"
          class="card project-card"
        >
          <header class="project-card__header">
            <h3 class="project-card__name">{{ p.name }}</h3>
            <span class="project-card__rate">{{ p.hourlyRate }} ₽/час</span>
          </header>
          <dl class="project-card__stats">
            <div>
              <dt>Задач</dt>
              <dd>{{ stat(p.id).total }}</dd>
            </div>
            <div>
              <dt>Выполнено</dt>
              <dd>{{ stat(p.id).done }}</dd>
            </div>
            <div>
              <dt>Время</dt>
              <dd>{{ formatDuration(stat(p.id).seconds) }}</dd>
            </div>
          </dl>
        </RouterLink>
      </div>
    </main>
  </div>

  <ProjectModal v-if="showAdd" @close="showAdd = false" />
  <ProjectModal v-if="editing" :project="editing" @close="editing = null" />
</template>
