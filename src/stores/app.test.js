import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { STORAGE_KEY, useAppStore } from './app'
import { setupPersistence } from './persistence'

const storeData = new Map()

beforeEach(() => {
  storeData.clear()
  globalThis.localStorage = {
    getItem: (k) => (storeData.has(k) ? storeData.get(k) : null),
    setItem: (k, v) => storeData.set(k, String(v)),
    removeItem: (k) => storeData.delete(k)
  }
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('таймер', () => {
  it('запуск задачи включает накопление времени, пауза останавливает, возобновление продолжает', () => {
    vi.useFakeTimers()
    const store = useAppStore()
    const project = store.addProject('Сайт заказчика', 3000)
    const task = store.addTask(project.id, { title: 'Главная страница' })

    expect(task.status).toBe('todo')
    expect(task.totalTimeSeconds).toBe(0)

    store.startTask(task.id)
    expect(task.status).toBe('in_progress')
    expect(task.timerStartAt).toBeTruthy()

    vi.advanceTimersByTime(5000)
    expect(task.totalTimeSeconds).toBe(5)

    store.pauseTask(task.id)
    expect(task.status).toBe('paused')
    expect(task.timerStartAt).toBeNull()

    vi.advanceTimersByTime(3000)
    expect(task.totalTimeSeconds).toBe(5)

    store.resumeTask(task.id)
    expect(task.status).toBe('in_progress')

    vi.advanceTimersByTime(2000)
    expect(task.totalTimeSeconds).toBe(7)
  })

  it('пропущенные тики (фоновая вкладка) не теряют время — пересчёт по timerStartAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T10:00:00Z'))
    const store = useAppStore()
    const project = store.addProject('Сайт', 3000)
    const task = store.addTask(project.id, { title: 'A' })

    store.startTask(task.id)
    // имитация засыпания вкладки: интервал не тикал, а timerStartAt ушёл назад
    task.timerStartAt = Date.now() - 9000
    vi.advanceTimersByTime(1000)

    expect(task.totalTimeSeconds).toBe(10)
  })

  it('параллельный запуск автоматически ставит активную задачу на паузу', () => {
    vi.useFakeTimers()
    const store = useAppStore()
    const project = store.addProject('Сайт', 3000)
    const a = store.addTask(project.id, { title: 'A' })
    const b = store.addTask(project.id, { title: 'B' })

    store.startTask(a.id)
    store.startTask(b.id)

    expect(a.status).toBe('paused')
    expect(b.status).toBe('in_progress')
    expect(a.timerStartAt).toBeNull()
  })

  it('завершение фиксирует время, дату и описание', () => {
    vi.useFakeTimers()
    const store = useAppStore()
    const project = store.addProject('Сайт', 3000)
    const task = store.addTask(project.id, { title: 'A' })

    store.startTask(task.id)
    vi.advanceTimersByTime(4100)
    store.completeTask(task.id, 'Вёрстка готова')

    expect(task.status).toBe('done')
    expect(task.completedDescription).toBe('Вёрстка готова')
    expect(task.completedAt).toBeTruthy()
    expect(task.totalTimeSeconds).toBe(4)
    expect(task.timerStartAt).toBeNull()
  })

  it('восстанавливает активный таймер при инициализации с учётом прошедшего времени', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T10:00:00Z'))
    const started = Date.now() - 15000

    storeData.set(
      STORAGE_KEY,
      JSON.stringify({
        projects: [{ id: 'p1', name: 'Сайт', hourlyRate: 3000, createdAt: 1 }],
        tasks: [
          {
            id: 't1',
            projectId: 'p1',
            title: 'A',
            description: '',
            links: '',
            priority: 'yellow',
            status: 'in_progress',
            totalTimeSeconds: 100,
            timerStartAt: started,
            completedAt: null,
            completedDescription: '',
            createdAt: 1
          }
        ]
      })
    )

    const store = useAppStore()
    store.init()

    const task = store.tasks[0]
    expect(task.totalTimeSeconds).toBe(115)
    expect(task.timerStartAt).toBe(Date.now())
    expect(task.status).toBe('in_progress')

    vi.advanceTimersByTime(2000)
    expect(task.totalTimeSeconds).toBe(117)
  })
})

describe('данные', () => {
  it('проект создаётся со ставкой по умолчанию и сохраняется в localStorage с debounce', () => {
    vi.useFakeTimers()
    const store = useAppStore()
    setupPersistence(store)

    store.addProject('Сайт', 3000)
    expect(storeData.has(STORAGE_KEY)).toBe(false) // ещё не сохранилось

    vi.advanceTimersByTime(3000)
    const saved = JSON.parse(storeData.get(STORAGE_KEY))
    expect(saved.projects).toHaveLength(1)
    expect(saved.projects[0].hourlyRate).toBe(3000)
  })

  it('addTask создаёт задачу с дефолтным приоритетом и статусом todo', () => {
    const store = useAppStore()
    const project = store.addProject('Сайт', 3000)
    const task = store.addTask(project.id, { title: 'Задача' })

    expect(task.priority).toBe('yellow')
    expect(task.status).toBe('todo')
    expect(task.totalTimeSeconds).toBe(0)
    expect(task.completedAt).toBeNull()
  })

  it('replaceAll восстанавливает данные из резервной копии и перезапускает таймер', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T10:00:00Z'))
    const store = useAppStore()

    const started = Date.now() - 5000
    store.replaceAll(
      [{ id: 'p9', name: 'Бэкап-проект', hourlyRate: 2500, createdAt: 1 }],
      [
        {
          id: 't9',
          projectId: 'p9',
          title: 'Задача из бэкапа',
          description: '',
          links: '',
          priority: 'red',
          status: 'in_progress',
          totalTimeSeconds: 10,
          timerStartAt: started,
          completedAt: null,
          completedDescription: '',
          createdAt: 1
        }
      ]
    )

    const task = store.tasks[0]
    expect(task.totalTimeSeconds).toBe(15)
    expect(task.status).toBe('in_progress')

    vi.advanceTimersByTime(1000)
    expect(task.totalTimeSeconds).toBe(16)
  })

  it('удаление активной задачи останавливает таймер', () => {
    vi.useFakeTimers()
    const store = useAppStore()
    const project = store.addProject('Сайт', 3000)
    const a = store.addTask(project.id, { title: 'A' })
    const b = store.addTask(project.id, { title: 'B' })

    store.startTask(a.id)
    vi.advanceTimersByTime(3000)

    store.deleteTask(a.id)
    expect(store.tasks).toHaveLength(1)
    expect(store.tasks[0].id).toBe(b.id)
    expect(store.activeTask).toBeNull()

    // таймер остановлен: время больше не растёт
    vi.advanceTimersByTime(3000)
    expect(store.tasks[0].totalTimeSeconds).toBe(0)
  })
})

describe('ручное редактирование времени', () => {
  it('setTaskTime устанавливает время завершённой задаче, не меняя статус', () => {
    const store = useAppStore()
    const project = store.addProject('Сайт', 3000)
    const task = store.addTask(project.id, { title: 'A' })
    store.completeTask(task.id, 'Готово')

    store.setTaskTime(task.id, 7200)

    expect(task.totalTimeSeconds).toBe(7200)
    expect(task.status).toBe('done')
    expect(task.completedDescription).toBe('Готово')
  })

  it('отрицательные и нечисловые значения трактуются как ноль', () => {
    const store = useAppStore()
    const project = store.addProject('Сайт', 3000)
    const task = store.addTask(project.id, { title: 'A' })

    store.setTaskTime(task.id, -50)
    expect(task.totalTimeSeconds).toBe(0)

    store.setTaskTime(task.id, NaN)
    expect(task.totalTimeSeconds).toBe(0)
  })

  it('после ручной правки активный таймер продолжает накапливать время', () => {
    vi.useFakeTimers()
    const store = useAppStore()
    const project = store.addProject('Сайт', 3000)
    const task = store.addTask(project.id, { title: 'A' })

    store.startTask(task.id)
    vi.advanceTimersByTime(3000)
    store.setTaskTime(task.id, 600)
    vi.advanceTimersByTime(2000)

    expect(task.totalTimeSeconds).toBe(602)
  })
})
