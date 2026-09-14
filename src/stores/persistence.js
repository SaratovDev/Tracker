import { STORAGE_KEY } from './app'

/**
 * Персистентность: запись в localStorage с debounce.
 * Изменения сохраняются через 2 секунды после последнего изменения,
 * страховочно — раз в 5 секунд при наличии «грязных» данных,
 * а также при закрытии/скрытии страницы.
 */
export function setupPersistence(store) {
  let timer = null
  let dirty = false

  const save = () => {
    dirty = false
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ projects: store.projects, tasks: store.tasks })
      )
    } catch (err) {
      console.error('Не удалось сохранить данные:', err)
    }
  }

  const flush = () => {
    if (timer != null) clearTimeout(timer)
    if (dirty) save()
  }

  store.$subscribe(
    () => {
      dirty = true
      if (timer != null) clearTimeout(timer)
      timer = setTimeout(save, 2000)
    },
    { flush: 'sync' }
  )

  setInterval(() => {
    if (dirty) save()
  }, 5000)

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  return flush
}
