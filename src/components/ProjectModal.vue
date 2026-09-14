<script setup>
import { reactive, ref, watch } from 'vue'
import { useAppStore } from '../stores/app'
import AppModal from './AppModal.vue'

const props = defineProps({
  project: { type: Object, default: null }
})

const emit = defineEmits(['close'])

const store = useAppStore()
const form = reactive({ name: '', hourlyRate: 3000 })
const error = ref('')

watch(
  () => props.project,
  (p) => {
    if (p) {
      form.name = p.name
      form.hourlyRate = p.hourlyRate
    } else {
      form.name = ''
      form.hourlyRate = 3000
    }
    error.value = ''
  },
  { immediate: true }
)

function submit() {
  if (!form.name.trim()) {
    error.value = 'Укажите название проекта'
    return
  }
  if (form.hourlyRate === '' || form.hourlyRate === null || !Number.isFinite(Number(form.hourlyRate)) || Number(form.hourlyRate) < 0) {
    error.value = 'Укажите корректную часовую ставку'
    return
  }
  if (props.project) {
    store.updateProject(props.project.id, { name: form.name, hourlyRate: Number(form.hourlyRate) })
  } else {
    store.addProject(form.name, Number(form.hourlyRate))
  }
  emit('close')
}
</script>

<template>
  <AppModal :title="project ? 'Редактировать проект' : 'Новый проект'" @close="emit('close')">
    <form @submit.prevent="submit">
      <label class="field">
        <span class="field__label">Название проекта</span>
        <input v-model="form.name" type="text" class="input" placeholder="Например: Сайт компании" />
      </label>
      <label class="field">
        <span class="field__label">Часовая ставка (руб/час)</span>
        <input v-model.number="form.hourlyRate" type="number" min="0" step="any" class="input" />
      </label>
      <p v-if="error" class="form-error">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary-link" @click="emit('close')">Отмена</button>
        <button type="submit" class="btn btn-primary">{{ project ? 'Сохранить' : 'Добавить проект' }}</button>
      </div>
    </form>
  </AppModal>
</template>
