export const PRIORITY_META = {
  green: { label: 'Низкий' },
  yellow: { label: 'Средний' },
  red: { label: 'Высокий' }
}

export const STATUS_META = {
  todo: { label: 'К выполнению' },
  in_progress: { label: 'В работе' },
  paused: { label: 'На паузе' },
  done: { label: 'Выполнено' }
}

export const STATUS_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активные' },
  { key: 'paused', label: 'На паузе' },
  { key: 'done', label: 'Выполненные' }
]

/** «Активные» = не завершённые и не на паузе (todo + in_progress) */
export function matchesFilter(task, filter) {
  if (filter === 'all') return true
  if (filter === 'active') return task.status === 'todo' || task.status === 'in_progress'
  return task.status === filter
}
