<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'
import AppModal from './AppModal.vue'
import StatusBadge from './StatusBadge.vue'
import AppIcon from './AppIcon.vue'
import { PRIORITY_META } from '../utils/meta'
import { formatClock, formatDate } from '../utils/time'

const props = defineProps({
  task: { type: Object, required: true }
})

const emit = defineEmits(['close'])

const store = useAppStore()
const auth = useAuthStore()

// редактируемые поля задачи
const draft = reactive({ title: '', description: '', links: '', priority: 'yellow' })

watch(
  () => props.task,
  (t) => {
    draft.title = t.title
    draft.description = t.description
    draft.links = t.links
    draft.priority = t.priority
  },
  { immediate: true }
)

// автосохранение полей при изменении — только для админа
watch(
  draft,
  () => {
    if (!auth.isAdmin) return
    store.updateTask(props.task.id, { ...draft })
  },
  { deep: true }
)

const parsedLinks = computed(() =>
  (draft.links || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const href = /^https?:\/\//i.test(text) ? text : `https://${text}`
      return { text, href }
    })
)

// мини-диалог завершения
const showComplete = ref(false)
const completeText = ref('')

// мини-диалог удаления задачи
const showDelete = ref(false)

// редактирование «Что было выполнено» у завершённой задачи
const editingDone = ref(false)
const doneText = ref('')

// ручное редактирование затраченного времени
const timeEditing = ref(false)
const timeHours = ref(0)
const timeMinutes = ref(0)

function openTimeEdit() {
  const s = Math.max(0, Math.floor(props.task.totalTimeSeconds || 0))
  timeHours.value = Math.floor(s / 3600)
  timeMinutes.value = Math.floor((s % 3600) / 60)
  timeEditing.value = true
}

function saveTime() {
  const h = Math.max(0, Math.floor(Number(timeHours.value) || 0))
  const m = Math.max(0, Math.floor(Number(timeMinutes.value) || 0))
  store.setTaskTime(props.task.id, h * 3600 + m * 60)
  timeEditing.value = false
}

function start() {
  store.startTask(props.task.id)
  emit('close')
}

function pause() {
  store.pauseTask(props.task.id)
}

function resume() {
  store.resumeTask(props.task.id)
}

function openComplete() {
  completeText.value = ''
  showComplete.value = true
}

function confirmComplete() {
  const text = completeText.value.trim()
  if (!text) return
  store.completeTask(props.task.id, text)
  showComplete.value = false
  emit('close')
}

function toggleEditDone() {
  if (editingDone.value) {
    editingDone.value = false
    return
  }
  doneText.value = props.task.completedDescription || ''
  editingDone.value = true
}

function saveDone() {
  store.updateTask(props.task.id, { completedDescription: doneText.value })
  editingDone.value = false
}

function openDelete() {
  showDelete.value = true
}

function confirmDelete() {
  store.deleteTask(props.task.id)
  showDelete.value = false
  emit('close')
}
</script>

<template>
  <AppModal title="Задача" width="640px" @close="emit('close')">
    <form @submit.prevent>
      <p v-if="!auth.isAdmin" class="readonly-note">
        <AppIcon name="eye" :size="12" />
        Только просмотр — изменение данных недоступно для роли «Гость»
      </p>

      <label class="field">
        <span class="field__label">Название</span>
        <input v-model="draft.title" type="text" class="input" :readonly="!auth.isAdmin" />
      </label>

      <label class="field">
        <span class="field__label">Описание</span>
        <textarea v-model="draft.description" class="input" rows="3" :readonly="!auth.isAdmin"></textarea>
      </label>

      <label class="field">
        <span class="field__label">Ссылки и материалы</span>
        <textarea
          v-model="draft.links"
          class="input"
          rows="3"
          placeholder="Каждая ссылка с новой строки"
          :readonly="!auth.isAdmin"
        ></textarea>
        <div v-if="parsedLinks.length" class="links-list">
          <a
            v-for="(link, i) in parsedLinks"
            :key="i"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            class="link-item"
          >
            <AppIcon name="link" :size="14" />
            {{ link.text }}
          </a>
        </div>
      </label>

      <div class="field">
        <span class="field__label">Приоритет</span>
        <div class="priority-control" role="radiogroup" aria-label="Приоритет">
          <button
            v-for="(meta, key) in PRIORITY_META"
            :key="key"
            type="button"
            class="priority-option"
            :class="{ active: draft.priority === key }"
            :aria-pressed="draft.priority === key"
            :disabled="!auth.isAdmin"
            @click="draft.priority = key"
          >
            <span class="priority-dot" :class="`priority-${key}`" />
            {{ meta.label }}
          </button>
        </div>
      </div>

      <dl class="task-facts">
        <div class="task-fact">
          <dt>Статус</dt>
          <dd><StatusBadge :status="task.status" /></dd>
        </div>
        <div class="task-fact" :class="{ 'task-fact--wide': timeEditing }">
          <dt>Затраченное время</dt>
          <dd v-if="!timeEditing" class="task-fact__time">
            <span>{{ formatClock(task.totalTimeSeconds) }}</span>
            <button
              v-if="auth.isAdmin"
              type="button"
              class="icon-btn"
              aria-label="Изменить затраченное время"
              title="Изменить время"
              @click="openTimeEdit"
            >
              <AppIcon name="pencil" :size="14" />
            </button>
          </dd>
          <dd v-else class="time-edit">
            <input v-model.number="timeHours" type="number" min="0" class="input time-edit__num" aria-label="Часы" />
            <span class="time-edit__unit">ч</span>
            <input v-model.number="timeMinutes" type="number" min="0" class="input time-edit__num" aria-label="Минуты" />
            <span class="time-edit__unit">мин</span>
            <button type="button" class="btn btn-primary time-edit__save" @click="saveTime">Сохранить</button>
            <button type="button" class="btn btn-secondary-link" @click="timeEditing = false">Отмена</button>
          </dd>
        </div>
        <div v-if="task.status === 'done'" class="task-fact">
          <dt>Дата завершения</dt>
          <dd>{{ formatDate(task.completedAt) }}</dd>
        </div>
      </dl>

      <div v-if="task.status === 'done'" class="field">
        <span class="field__label">Что было выполнено</span>
        <template v-if="editingDone">
          <textarea v-model="doneText" class="input" rows="3" placeholder="Опишите выполненную работу"></textarea>
          <div class="modal-actions">
            <button type="button" class="btn btn-primary" @click="saveDone">Сохранить</button>
          </div>
        </template>
        <p v-else class="done-text">{{ task.completedDescription || '—' }}</p>
      </div>
    </form>

    <template #footer>
      <div class="modal-actions">
        <button
          v-if="auth.isAdmin"
          type="button"
          class="btn btn-danger modal-actions__delete"
          @click="openDelete"
        >
          Удалить задачу
        </button>
        <template v-if="auth.isAdmin">
          <template v-if="task.status === 'todo'">
            <button type="button" class="btn btn-primary" @click="start">Приступить к выполнению</button>
          </template>

          <template v-else-if="task.status === 'in_progress'">
            <button type="button" class="btn btn-secondary-link" @click="pause">Пауза</button>
            <button type="button" class="btn btn-primary" @click="openComplete">Завершить</button>
          </template>

          <template v-else-if="task.status === 'paused'">
            <button type="button" class="btn btn-primary" @click="resume">Возобновить</button>
            <button type="button" class="btn btn-secondary-link" @click="openComplete">Завершить</button>
          </template>

          <template v-else>
            <button type="button" class="btn btn-secondary-link" @click="toggleEditDone">
              {{ editingDone ? 'Отмена' : 'Редактировать' }}
            </button>
          </template>
        </template>

        <button v-else type="button" class="btn btn-primary" @click="emit('close')">Закрыть</button>
      </div>
    </template>
  </AppModal>

  <!-- мини-диалог подтверждения завершения -->
  <AppModal
    v-if="showComplete"
    title="Завершить задачу"
    width="480px"
    :close-on-overlay="false"
    @close="showComplete = false"
  >
    <form @submit.prevent="confirmComplete">
      <label class="field">
        <span class="field__label">Что было выполнено</span>
        <textarea
          v-model="completeText"
          class="input"
          rows="3"
          required
          placeholder="Опишите выполненную работу"
        ></textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary-link" @click="showComplete = false">Отмена</button>
        <button type="submit" class="btn btn-primary" :disabled="!completeText.trim()">Завершить</button>
      </div>
    </form>
  </AppModal>

  <!-- мини-диалог удаления задачи -->
  <AppModal
    v-if="showDelete"
    title="Удалить задачу"
    width="480px"
    :close-on-overlay="false"
    @close="showDelete = false"
  >
    <p class="modal-block">Задача «{{ task.title }}» будет удалена безвозвратно вместе с учтённым временем.</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary-link" @click="showDelete = false">Отмена</button>
      <button type="button" class="btn btn-danger" @click="confirmDelete">Удалить</button>
    </div>
  </AppModal>
</template>
