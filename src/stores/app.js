import { defineStore } from 'pinia'
import { useToastStore } from './toast'

export const STORAGE_KEY = 'tasktracker_data'

export function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data.projects) && Array.isArray(data.tasks)) {
        return { projects: data.projects, tasks: data.tasks }
      }
    }
  } catch (err) {
    console.error('Не удалось прочитать сохранённые данные:', err)
  }
  return { projects: [], tasks: [] }
}

export const useAppStore = defineStore('app', {
  state: () => ({
    projects: [],
    tasks: [],
    restored: false
  }),

  getters: {
    activeTask(state) {
      return state.tasks.find((t) => t.status === 'in_progress') || null
    },
    projectById(state) {
      return (id) => state.projects.find((p) => p.id === id) || null
    },
    tasksByProject(state) {
      return (projectId) => state.tasks.filter((t) => t.projectId === projectId)
    }
  },

  actions: {
    /** Инициализация при загрузке приложения: восстановление таймера */
    init() {
      if (this.restored) return
      const data = loadState()
      this.projects = data.projects
      this.tasks = data.tasks

      const activeList = this.tasks.filter((t) => t.status === 'in_progress')
      if (activeList.length > 1) {
        // на случай повреждённых данных: активной может быть только одна задача
        activeList.slice(1).forEach((t) => {
          t.status = 'paused'
          t.timerStartAt = null
        })
      }
      const active = activeList[0]
      if (active && active.timerStartAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - active.timerStartAt) / 1000))
        active.totalTimeSeconds = (active.totalTimeSeconds || 0) + elapsed
        active.timerStartAt = Date.now()
        this.startTimer()
      }
      this.restored = true
    },

    /** setInterval с шагом 1 секунда: тикает только активная задача */
    startTimer() {
      if (this._timerId != null) return
      this._timerId = setInterval(() => {
        const active = this.activeTask
        if (active && active.timerStartAt) {
          // время пересчитывается от timerStartAt: пропущенные тики
          // (фоновая вкладка) не теряются
          const elapsed = Math.floor((Date.now() - active.timerStartAt) / 1000)
          if (elapsed > 0) {
            active.totalTimeSeconds = (active.totalTimeSeconds || 0) + elapsed
            active.timerStartAt = Date.now()
          }
        } else {
          this.stopTimer()
        }
      }, 1000)
    },

    stopTimer() {
      if (this._timerId != null) {
        clearInterval(this._timerId)
        this._timerId = null
      }
    },

    addProject(name, hourlyRate) {
      const project = {
        id: uid(),
        name: String(name || '').trim(),
        hourlyRate: Number(hourlyRate),
        createdAt: Date.now()
      }
      this.projects.push(project)
      return project
    },

    updateProject(id, patch) {
      const project = this.projects.find((p) => p.id === id)
      if (!project) return
      if (patch.name != null) project.name = String(patch.name).trim()
      if (patch.hourlyRate != null) project.hourlyRate = Number(patch.hourlyRate)
    },

    addTask(projectId, data) {
      const task = {
        id: uid(),
        projectId,
        title: String(data.title || '').trim(),
        description: data.description || '',
        links: data.links || '',
        priority: data.priority || 'yellow',
        status: 'todo',
        totalTimeSeconds: 0,
        timerStartAt: null,
        completedAt: null,
        completedDescription: '',
        createdAt: Date.now()
      }
      this.tasks.push(task)
      return task
    },

    updateTask(id, patch) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) return
      Object.assign(task, patch)
    },

    /** Ручная установка затраченного времени (в т.ч. для завершённых задач) */
    setTaskTime(id, totalSeconds) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) return
      task.totalTimeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
    },

    /**
     * Запуск/возобновление задачи. Если другая задача уже в работе —
     * она автоматически переводится в paused, её таймер фиксируется.
     */
    startTask(id, { resumed = false } = {}) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task || task.status === 'done') return
      const other = this.activeTask
      if (other && other.id !== id) {
        this.pauseTask(other.id)
      }
      task.status = 'in_progress'
      task.timerStartAt = Date.now()
      this.startTimer()
      this.toast(`Задача «${task.title}» ${resumed ? 'возобновлена' : 'запущена'}`)
    },

    pauseTask(id) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task || task.status !== 'in_progress') return
      task.status = 'paused'
      task.timerStartAt = null
      if (!this.activeTask) this.stopTimer()
      this.toast(`Задача «${task.title}» поставлена на паузу`)
    },

    resumeTask(id) {
      this.startTask(id, { resumed: true })
    },

    completeTask(id, completedDescription) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) return
      task.status = 'done'
      task.timerStartAt = null
      task.completedAt = Date.now()
      task.completedDescription = String(completedDescription || '').trim()
      if (!this.activeTask) this.stopTimer()
      this.toast(`Задача «${task.title}» завершена`)
    },

    /** Удаление задачи; если удалялась активная — таймер останавливается */
    deleteTask(id) {
      const idx = this.tasks.findIndex((t) => t.id === id)
      if (idx === -1) return
      const task = this.tasks[idx]
      this.tasks.splice(idx, 1)
      if (!this.activeTask) this.stopTimer()
      this.toast(`Задача «${task.title}» удалена`)
    },

    /** Полная замена данных (загрузка резервной копии) с восстановлением таймера */
    replaceAll(projects, tasks) {
      this.stopTimer()
      this.projects = projects
      this.tasks = tasks
      this.restored = true
      const activeList = this.tasks.filter((t) => t.status === 'in_progress')
      if (activeList.length > 1) {
        activeList.slice(1).forEach((t) => {
          t.status = 'paused'
          t.timerStartAt = null
        })
      }
      const active = activeList[0]
      if (active && active.timerStartAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - active.timerStartAt) / 1000))
        active.totalTimeSeconds = (active.totalTimeSeconds || 0) + elapsed
        active.timerStartAt = Date.now()
        this.startTimer()
      }
    },

    toast(message) {
      useToastStore().show(message)
    }
  }
})
