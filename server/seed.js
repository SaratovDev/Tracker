import { validateData } from './data-schema.js'
import { seedData } from './seed-data.js'

let cached

/**
 * Стартовые задачи для первого запуска после деплоя.
 * Подставляются только в пустое хранилище, поэтому достаточно один раз
 * загрузить в него актуальный бэкап кнопкой «Загрузить бэкап» — дальше
 * источником правды становится хранилище, а seed-data.js больше не влияет.
 *
 * Файл seed-data.js генерируется скриптом: npm run import-backup -- <бэкап.json>
 */
export function getSeed() {
  if (cached !== undefined) return cached

  const result = validateData(seedData)
  if (!result.ok) {
    console.error('Стартовые данные в server/seed-data.js некорректны:', result.error)
    cached = null
    return cached
  }

  cached = result.value
  return cached
}
