<script setup>
import { reactive, ref } from 'vue'
import { useAppStore } from '../stores/app'
import AppModal from './AppModal.vue'
import { PRIORITY_META } from '../utils/meta'

const props = defineProps({
  projectId: { type: String, required: true }
})

const emit = defineEmits(['close'])

const store = useAppStore()
const form = reactive({ title: '', description: '', links: '', priority: 'yellow' })
const error = ref('')

function submit() {
  if (!form.title.trim()) {
    error.value = 'Укажите название задачи'
    return
  }
  store.addTask(props.projectId, {
    title: form.title,
    description: form.description,
    links: form.links,
    priority: form.priority
  })
  emit('close')
}
</script>

<template>
  <AppModal title="Новая задача" @close="emit('close')">
    <form @submit.prevent="submit">
      <label class="field">
        <span class="field__label">Название</span>
        <input v-model="form.title" type="text" class="input" placeholder="Название задачи" />
      </label>
      <label class="field">
        <span class="field__label">Описание</span>
        <textarea v-model="form.description" class="input" rows="3"></textarea>
      </label>
      <label class="field">
        <span class="field__label">Ссылки и материалы</span>
        <textarea v-model="form.links" class="input" rows="3" placeholder="Каждая ссылка с новой строки"></textarea>
      </label>
      <div class="field">
        <span class="field__label">Приоритет</span>
        <div class="priority-control" role="radiogroup" aria-label="Приоритет">
          <button
            v-for="(meta, key) in PRIORITY_META"
            :key="key"
            type="button"
            class="priority-option"
            :class="{ active: form.priority === key }"
            :aria-pressed="form.priority === key"
            @click="form.priority = key"
          >
            <span class="priority-dot" :class="`priority-${key}`" />
            {{ meta.label }}
          </button>
        </div>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary-link" @click="emit('close')">Отмена</button>
        <button type="submit" class="btn btn-primary">Добавить задачу</button>
      </div>
    </form>
  </AppModal>
</template>
