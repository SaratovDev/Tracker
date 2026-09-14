<script setup>
import { nextTick, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import AppModal from './AppModal.vue'
import AppIcon from './AppIcon.vue'

const ERROR_MESSAGES = {
  invalid: 'Неверный пароль',
  rate_limited: 'Слишком много попыток. Попробуйте позже',
  unavailable: 'Сервер авторизации недоступен. Обратитесь к администратору'
}

const auth = useAuthStore()

const step = ref('role')
const password = ref('')
const error = ref('')
const passwordInput = ref(null)

function chooseAdmin() {
  password.value = ''
  error.value = ''
  step.value = 'password'
  nextTick(() => passwordInput.value?.focus())
}

function chooseGuest() {
  auth.loginGuest()
}

function back() {
  step.value = 'role'
  password.value = ''
  error.value = ''
}

async function submitPassword() {
  if (auth.checkingPassword) return

  error.value = ''
  const result = await auth.loginAdmin(password.value)
  if (result.ok) return

  password.value = ''
  if (result.reason === 'rate_limited' && result.retryAfterSeconds) {
    const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60))
    error.value = `Слишком много попыток. Повторите через ${minutes} мин.`
  } else {
    error.value = ERROR_MESSAGES[result.reason] || 'Не удалось войти'
  }
  passwordInput.value?.focus()
}
</script>

<template>
  <AppModal
    title="Выберите вашу роль"
    width="480px"
    :closable="false"
    :close-on-overlay="false"
  >
    <template v-if="step === 'role'">
      <p class="role-gate__hint">От выбранной роли зависит доступ к изменению данных.</p>
      <div class="role-gate__options">
        <button type="button" class="role-option" @click="chooseAdmin">
          <span class="role-option__label">
            <AppIcon name="pencil" :size="14" />
            Администратор
          </span>
          <span class="role-option__desc">
            Полный доступ: добавление, редактирование, удаление, таймер
          </span>
        </button>
        <button type="button" class="role-option" @click="chooseGuest">
          <span class="role-option__label">
            <AppIcon name="eye" :size="14" />
            Гость
          </span>
          <span class="role-option__desc">
            Просмотр всех проектов и задач, отчёты — без изменения данных
          </span>
        </button>
      </div>
    </template>

    <form v-else @submit.prevent="submitPassword">
      <p class="role-gate__hint">Введите пароль администратора.</p>
      <label class="field">
        <span class="field__label">Пароль</span>
        <input
          ref="passwordInput"
          v-model="password"
          type="password"
          class="input"
          autocomplete="current-password"
          aria-label="Пароль администратора"
          :disabled="auth.checkingPassword"
        />
      </label>
      <p v-if="error" class="form-error">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary-link" @click="back">Назад</button>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="!password || auth.checkingPassword"
        >
          {{ auth.checkingPassword ? 'Проверка…' : 'Войти' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
