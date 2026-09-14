<script setup>
import { computed, ref } from 'vue'
import { useAppStore } from '../stores/app'
import PriorityDot from '../components/PriorityDot.vue'
import StatusBadge from '../components/StatusBadge.vue'
import TaskModal from '../components/TaskModal.vue'
import { PRIORITY_META, STATUS_FILTERS, matchesFilter } from '../utils/meta'
import { formatDuration, formatDate } from '../utils/time'

const store = useAppStore()

const projectFilter = ref('all')
const statusFilter = ref('all')
const priorityFilter = ref('all')
const query = ref('')
const openId = ref(null)

const projectName = (id) => store.projectById(id)?.name || '—'

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  return store.tasks
    .filter((t) => projectFilter.value === 'all' || t.projectId === projectFilter.value)
    .filter((t) => matchesFilter(t, statusFilter.value))
    .filter((t) => priorityFilter.value === 'all' || t.priority === priorityFilter.value)
    .filter((t) => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => {
      const byProject = projectName(a.projectId).localeCompare(projectName(b.projectId), 'ru')
      return byProject !== 0 ? byProject : a.createdAt - b.createdAt
    })
})

const totalSeconds = computed(() => rows.value.reduce((s, t) => s + (t.totalTimeSeconds || 0), 0))
const openTask = computed(() => store.tasks.find((t) => t.id === openId.value) || null)

function onRowKeydown(e, task) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openId.value = task.id
  }
}
</script>

<template>
  <div class="all-tasks">
    <h1 class="page-title">Все задачи</h1>

    <div class="report-toolbar">
      <div class="report-field">
        <label for="at-project">Проект</label>
        <select id="at-project" v-model="projectFilter" class="input report-select">
          <option value="all">Все проекты</option>
          <option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="report-field">
        <label for="at-status">Статус</label>
        <select id="at-status" v-model="statusFilter" class="input all-tasks__filter">
          <option v-for="f in STATUS_FILTERS" :key="f.key" :value="f.key">{{ f.label }}</option>
        </select>
      </div>
      <div class="report-field">
        <label for="at-priority">Приоритет</label>
        <select id="at-priority" v-model="priorityFilter" class="input all-tasks__filter">
          <option value="all">Все</option>
          <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">
            {{ meta.label }}
          </option>
        </select>
      </div>
      <div class="report-field">
        <label for="at-search">Поиск по названию</label>
        <input
          id="at-search"
          v-model="query"
          type="search"
          class="input all-tasks__search"
          placeholder="Название задачи"
        />
      </div>
    </div>

    <p v-if="!store.tasks.length" class="empty-state">Задач пока нет</p>
    <template v-else>
      <p class="all-tasks__summary">
        Найдено задач: {{ rows.length }} · суммарное время: {{ formatDuration(totalSeconds) }}
      </p>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="all-tasks__col-project">Проект</th>
              <th class="all-tasks__col-task">Задача</th>
              <th class="all-tasks__col-priority">Приоритет</th>
              <th class="all-tasks__col-status">Статус</th>
              <th class="all-tasks__col-time num">Время</th>
              <th class="all-tasks__col-date">Завершено</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rows.length">
              <td colspan="6" class="muted">Задач по выбранным фильтрам не найдено</td>
            </tr>
            <tr
              v-for="t in rows"
              :key="t.id"
              class="all-tasks__row"
              role="button"
              tabindex="0"
              :aria-label="`Открыть задачу «${t.title}»`"
              @click="openId = t.id"
              @keydown="onRowKeydown($event, t)"
            >
              <td>{{ projectName(t.projectId) }}</td>
              <td>{{ t.title }}</td>
              <td>
                <span class="report-priority">
                  <PriorityDot :priority="t.priority" />
                  {{ PRIORITY_META[t.priority]?.label || t.priority }}
                </span>
              </td>
              <td><StatusBadge :status="t.status" /></td>
              <td class="num">{{ formatDuration(t.totalTimeSeconds) }}</td>
              <td>{{ t.status === 'done' ? formatDate(t.completedAt) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <TaskModal v-if="openTask" :task="openTask" @close="openId = null" />
  </div>
</template>
