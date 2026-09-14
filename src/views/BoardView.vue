<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'
import TaskCard from '../components/TaskCard.vue'
import TaskModal from '../components/TaskModal.vue'
import AddTaskModal from '../components/AddTaskModal.vue'
import AppIcon from '../components/AppIcon.vue'
import { STATUS_FILTERS, matchesFilter } from '../utils/meta'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const auth = useAuthStore()

const project = computed(() => store.projectById(route.params.id))

watchEffect(() => {
  if (!project.value) router.replace('/')
})

const filter = ref('all')
const showAdd = ref(false)
const openId = ref(null)

const tasks = computed(() => store.tasksByProject(route.params.id))
const visibleTasks = computed(() => tasks.value.filter((t) => matchesFilter(t, filter.value)))
const openTask = computed(() => store.tasks.find((t) => t.id === openId.value) || null)

const counts = computed(() => {
  const c = { all: tasks.value.length, active: 0, paused: 0, done: 0 }
  for (const t of tasks.value) {
    if (t.status === 'todo' || t.status === 'in_progress') c.active += 1
    else if (t.status === 'paused' || t.status === 'done') c[t.status] += 1
  }
  return c
})
</script>

<template>
  <div v-if="project" class="board">
    <header class="board__head">
      <h1 class="page-title board__title">{{ project.name }}</h1>
      <button v-if="auth.isAdmin" type="button" class="btn btn-primary" @click="showAdd = true">
        <AppIcon name="plus" :size="14" />
        Добавить задачу
      </button>
    </header>

    <div class="filters" role="group" aria-label="Фильтр по статусам">
      <button
        v-for="f in STATUS_FILTERS"
        :key="f.key"
        type="button"
        class="filter-btn"
        :class="{ active: filter === f.key }"
        :aria-pressed="filter === f.key"
        @click="filter = f.key"
      >
        {{ f.label }} ({{ counts[f.key] }})
      </button>
    </div>

    <p v-if="!tasks.length" class="empty-state">
      {{ auth.isAdmin ? 'Добавьте первую задачу' : 'Задач пока нет' }}
    </p>
    <p v-else-if="!visibleTasks.length" class="empty-state">Нет задач с таким статусом</p>
    <div v-else class="grid">
      <TaskCard v-for="t in visibleTasks" :key="t.id" :task="t" @open="openId = t.id" />
    </div>

    <AddTaskModal v-if="showAdd" :project-id="project.id" @close="showAdd = false" />
    <TaskModal v-if="openTask" :task="openTask" @close="openId = null" />
  </div>
</template>
