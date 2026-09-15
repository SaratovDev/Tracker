export const MAX_ITEMS = 5000
/** Лимит тела запроса PUT /api/data. Совпадает с лимитом тела Vercel-функции (~4.5 МБ). */
export const MAX_DATA_BYTES = 4 * 1024 * 1024

const MAX_ID = 200
const MAX_TITLE = 2000
const MAX_TEXT = 20000

export const PRIORITIES = ['green', 'yellow', 'red']
export const STATUSES = ['todo', 'in_progress', 'paused', 'done']

function fail(message) {
  return { ok: false, error: message }
}

function text(value, max, { required = false } = {}) {
  if (typeof value !== 'string') return required ? null : ''
  if (value.length > max) return null
  return value
}

function number(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function timestamp(value, fallback) {
  const parsed = number(value, null)
  return parsed == null ? fallback : parsed
}

/**
 * Проверка и очистка данных перед записью и после чтения.
 * Отбрасывает неизвестные поля, поэтому в хранилище не накапливается мусор.
 * Строгие правила только там, где от значения зависит логика приложения
 * (id, статус, приоритет, ставка) — остальное приводится к безопасному виду.
 */
export function validateData(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('ожидается объект с полями projects и tasks')
  }

  const { projects, tasks } = input
  if (!Array.isArray(projects) || !Array.isArray(tasks)) {
    return fail('projects и tasks должны быть массивами')
  }
  if (projects.length > MAX_ITEMS || tasks.length > MAX_ITEMS) {
    return fail(`больше ${MAX_ITEMS} проектов или задач не поддерживается`)
  }

  const cleanProjects = []
  for (const project of projects) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      return fail('проект должен быть объектом')
    }

    const id = text(project.id, MAX_ID, { required: true })
    if (!id) return fail('у проекта отсутствует корректный id')

    const name = text(project.name, MAX_ID, { required: true })
    if (name == null) return fail(`некорректное название проекта (id ${id})`)

    const hourlyRate = number(project.hourlyRate, null)
    if (hourlyRate == null || hourlyRate < 0) {
      return fail(`некорректная часовая ставка проекта «${name}»`)
    }

    cleanProjects.push({
      id,
      name,
      hourlyRate,
      createdAt: timestamp(project.createdAt, Date.now())
    })
  }

  const cleanTasks = []
  for (const task of tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      return fail('задача должна быть объектом')
    }

    const id = text(task.id, MAX_ID, { required: true })
    if (!id) return fail('у задачи отсутствует корректный id')

    const projectId = text(task.projectId, MAX_ID, { required: true })
    if (!projectId) return fail(`у задачи ${id} отсутствует projectId`)

    const title = text(task.title, MAX_TITLE, { required: true })
    if (title == null) return fail(`некорректное название задачи (id ${id})`)

    if (!STATUSES.includes(task.status)) {
      return fail(`неизвестный статус задачи «${title}»: ${JSON.stringify(task.status)}`)
    }

    if (!PRIORITIES.includes(task.priority)) {
      return fail(`неизвестный приоритет задачи «${title}»: ${JSON.stringify(task.priority)}`)
    }

    cleanTasks.push({
      id,
      projectId,
      title,
      description: text(task.description, MAX_TEXT) ?? '',
      links: text(task.links, MAX_TEXT) ?? '',
      priority: task.priority,
      status: task.status,
      totalTimeSeconds: Math.max(0, Math.floor(number(task.totalTimeSeconds, 0))),
      timerStartAt: timestamp(task.timerStartAt, null),
      completedAt: timestamp(task.completedAt, null),
      completedDescription: text(task.completedDescription, MAX_TEXT) ?? '',
      createdAt: timestamp(task.createdAt, Date.now())
    })
  }

  return { ok: true, value: { projects: cleanProjects, tasks: cleanTasks } }
}

export function emptyData() {
  return { projects: [], tasks: [] }
}
