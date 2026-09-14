<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAppStore } from '../stores/app'
import { useToastStore } from '../stores/toast'
import AppIcon from '../components/AppIcon.vue'
import PriorityDot from '../components/PriorityDot.vue'
import { PRIORITY_META } from '../utils/meta'
import { buildReport, exportReportXlsx, round2 } from '../utils/report'

const store = useAppStore()
const toast = useToastStore()

const projectId = ref('')
const from = ref('')
const to = ref('')

const rows = ref([])
const totals = reactive({ hours: 0, cost: 0 })

const project = computed(() => store.projectById(projectId.value))
const hasProjects = computed(() => store.projects.length > 0)

// выбор проекта по умолчанию — первый из списка
watch(
  () => store.projects.map((p) => p.id).join(','),
  (ids) => {
    if (projectId.value && ids.includes(projectId.value)) return
    projectId.value = store.projects[0] ? store.projects[0].id : ''
  },
  { immediate: true }
)

function generate() {
  if (!project.value) {
    rows.value = []
    totals.hours = 0
    totals.cost = 0
    return
  }
  rows.value = buildReport(
    store.tasks,
    project.value.id,
    project.value.hourlyRate,
    from.value,
    to.value
  )
  totals.hours = round2(rows.value.reduce((s, r) => s + r.hours, 0))
  totals.cost = round2(rows.value.reduce((s, r) => s + r.cost, 0))
}

onMounted(generate)
watch([projectId, from, to], generate)

function onGenerate() {
  generate()
  toast.show('Отчёт сформирован')
}

function onDownload() {
  if (!rows.value.length) {
    toast.show('Нет завершённых задач за выбранный период')
    return
  }
  exportReportXlsx(project.value, rows.value, from.value, to.value)
  toast.show('Файл Excel скачан')
}
</script>

<template>
  <div class="report">
    <h1 class="page-title">Отчёт</h1>

    <template v-if="hasProjects">
      <div class="report-toolbar">
        <div class="report-field">
          <label for="report-project">Проект</label>
          <select id="report-project" v-model="projectId" class="input report-select">
            <option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="report-field">
          <label for="report-from">С</label>
          <input id="report-from" v-model="from" type="date" class="input" />
        </div>
        <div class="report-field">
          <label for="report-to">По</label>
          <input id="report-to" v-model="to" type="date" class="input" />
        </div>
        <button type="button" class="btn btn-primary" @click="onGenerate">Сформировать отчёт</button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="table__col-task">Задача</th>
              <th class="table__col-priority">Приоритет</th>
              <th class="table__col-desc">Что выполнено</th>
              <th class="table__col-hours num">Время (ч)</th>
              <th class="table__col-cost num">Стоимость</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rows.length">
              <td colspan="5" class="muted">Нет завершённых задач за выбранный период</td>
            </tr>
            <tr v-for="r in rows" :key="r.task.id">
              <td>{{ r.task.title }}</td>
              <td>
                <span class="report-priority">
                  <PriorityDot :priority="r.task.priority" />
                  {{ PRIORITY_META[r.task.priority].label }}
                </span>
              </td>
              <td>{{ r.task.completedDescription || '—' }}</td>
              <td class="num">{{ r.hours.toFixed(2) }}</td>
              <td class="num">{{ r.cost.toFixed(2) }}</td>
            </tr>
            <tr v-if="rows.length" class="table__total">
              <td colspan="3">Итого</td>
              <td class="num">{{ totals.hours.toFixed(2) }}</td>
              <td class="num">{{ totals.cost.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="report-actions">
        <button type="button" class="btn btn-primary" @click="onDownload">
          <AppIcon name="download" :size="14" />
          Скачать XLSX
        </button>
      </div>
    </template>

    <p v-else class="empty-state">Сначала добавьте проект — отчёт формируется по завершённым задачам</p>
  </div>
</template>
