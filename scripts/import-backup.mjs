#!/usr/bin/env node
/**
 * Превращает скачанную из приложения резервную копию
 * (кнопка «Скачать бэкап») в модуль стартовых данных server/seed-data.js.
 *
 * Использование:
 *   npm run import-backup -- "C:\Users\Lenovo\Downloads\tasktracker_backup_2026-09-15.json"
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateData } from '../server/data-schema.js'

const inputPath = process.argv[2]

if (!inputPath) {
  console.error('Укажите путь к файлу резервной копии:')
  console.error('  npm run import-backup -- "<путь к tasktracker_backup_*.json>"')
  process.exit(1)
}

const source = resolve(inputPath)

let backup
try {
  backup = JSON.parse(readFileSync(source, 'utf8'))
} catch (err) {
  console.error(`Не удалось прочитать ${source}: ${err.message}`)
  process.exit(1)
}

const result = validateData(backup)
if (!result.ok) {
  console.error(`Бэкап не прошёл проверку: ${result.error}`)
  process.exit(1)
}

const { projects, tasks } = result.value
const exportedAt = typeof backup.exportedAt === 'string' ? backup.exportedAt : null
const target = fileURLToPath(new URL('../server/seed-data.js', import.meta.url))

const module = `// ВНИМАНИЕ: файл сгенерирован командой npm run import-backup — правки будут перезаписаны.
// Источник: ${basename(source)}${exportedAt ? ` (экспорт ${exportedAt})` : ''}
// Проектов: ${projects.length}, задач: ${tasks.length}.

export const seedSource = {
  file: ${JSON.stringify(basename(source))},
  exportedAt: ${exportedAt ? JSON.stringify(exportedAt) : 'null'}
}

export const seedData = ${JSON.stringify({ projects, tasks }, null, 2)}
`

writeFileSync(target, module, 'utf8')

console.log(`Готово: ${target}`)
console.log(`Проектов: ${projects.length}, задач: ${tasks.length}`)
