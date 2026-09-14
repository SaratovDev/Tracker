<script setup>
import { ref } from 'vue'
import { useAppStore } from './stores/app'
import { useAuthStore } from './stores/auth'
import { useToastStore } from './stores/toast'
import { setupPersistence } from './stores/persistence'
import ToastContainer from './components/ToastContainer.vue'
import TimerWindow from './components/TimerWindow.vue'
import RoleGate from './components/RoleGate.vue'
import AppIcon from './components/AppIcon.vue'

const store = useAppStore()
const auth = useAuthStore()
const toast = useToastStore()
const backupInput = ref(null)

// персистентность подключается один раз на уровне приложения
setupPersistence(store)

function downloadBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    projects: store.projects,
    tasks: store.tasks
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tasktracker_backup_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function isValidBackup(data) {
  if (!data || !Array.isArray(data.projects) || !Array.isArray(data.tasks)) return false
  const okProject = data.projects.every(
    (p) => p && typeof p.id === 'string' && typeof p.name === 'string'
  )
  const okTask = data.tasks.every(
    (t) => t && typeof t.id === 'string' && typeof t.projectId === 'string'
  )
  return okProject && okTask
}

function onBackupFile(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      if (!isValidBackup(data)) throw new Error('bad format')
      store.replaceAll(data.projects, data.tasks)
      toast.show('Резервная копия загружена')
    } catch {
      toast.show('Ошибка: неверный формат файла резервной копии')
    }
    event.target.value = ''
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="container topbar__inner">
        <RouterLink to="/" class="brand">TaskTracker</RouterLink>
        <nav v-if="auth.isAuthenticated" class="topnav" aria-label="Основная навигация">
          <RouterLink to="/" class="topnav__link">Проекты</RouterLink>
          <RouterLink to="/tasks" class="topnav__link">Все задачи</RouterLink>
          <RouterLink to="/report" class="topnav__link">Отчёт</RouterLink>
          <span
            class="role-chip"
            :class="auth.isAdmin ? 'role-chip--admin' : 'role-chip--guest'"
          >
            <AppIcon :name="auth.isAdmin ? 'pencil' : 'eye'" :size="12" />
            {{ auth.isAdmin ? 'Админ' : 'Гость' }}
          </span>
          <button type="button" class="topnav__link role-exit" @click="auth.logout()">
            Выйти
          </button>
        </nav>
      </div>
    </header>

    <main class="main">
      <div class="container">
        <RouterView />
      </div>
    </main>

    <footer v-if="auth.isAuthenticated" class="footer">
      <div class="container footer__inner">
        <button type="button" class="footer-link" @click="downloadBackup">Скачать бэкап</button>
        <button
          v-if="auth.isAdmin"
          type="button"
          class="footer-link"
          @click="backupInput?.click()"
        >
          Загрузить бэкап
        </button>
        <input
          ref="backupInput"
          type="file"
          accept=".json,application/json"
          class="hidden-input"
          @change="onBackupFile"
        />
      </div>
    </footer>

    <TimerWindow v-if="auth.isAuthenticated" />
    <ToastContainer />
    <RoleGate v-if="!auth.isAuthenticated" />
  </div>
</template>

<style scoped>
.footer__inner {
  display: flex;
  gap: var(--gap);
  width: 100%;
}
</style>
