import * as XLSX from 'xlsx'
import { PRIORITY_META } from './meta'

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function dateKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Попадание даты завершения в диапазон [from, to] включительно */
export function inRange(ts, from, to) {
  const key = dateKey(ts)
  if (from && key < from) return false
  if (to && key > to) return false
  return true
}

/**
 * Отчёт: только задачи со статусом done,
 * completedAt попадает в выбранный диапазон дат (включительно).
 * Время в часах округляется до 2 знаков после запятой.
 */
export function buildReport(tasks, projectId, hourlyRate, from, to) {
  return tasks
    .filter((t) => t.projectId === projectId && t.status === 'done' && t.completedAt != null)
    .filter((t) => inRange(t.completedAt, from, to))
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((t) => {
      const hours = round2(t.totalTimeSeconds / 3600)
      return { task: t, hours, cost: round2(hours * (hourlyRate || 0)) }
    })
}

function periodLabel(from, to) {
  if (!from && !to) return 'весь период'
  return `${from || '…'} — ${to || '…'}`
}

/**
 * Выгрузка в Excel: шапка с названием проекта, периодом и ставкой,
 * далее таблица задач с итоговой строкой.
 */
export function exportReportXlsx(project, rows, from, to) {
  const totalHours = round2(rows.reduce((s, r) => s + r.hours, 0))
  const totalCost = round2(rows.reduce((s, r) => s + r.cost, 0))

  const aoa = [
    ['Название проекта', project.name],
    ['Период', periodLabel(from, to)],
    ['Часовая ставка, руб/час', project.hourlyRate],
    [],
    ['Задача', 'Приоритет', 'Что выполнено', 'Время (ч)', 'Стоимость'],
    ...rows.map((r) => [
      r.task.title,
      PRIORITY_META[r.task.priority].label,
      r.task.completedDescription || '',
      r.hours,
      r.cost
    ]),
    [],
    ['Итого', '', '', totalHours, totalCost]
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 60 }, { wch: 12 }, { wch: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Отчёт')

  const safeName = String(project.name).replace(/[\\/:*?"<>|]/g, '_')
  const fileName = `Отчёт_${safeName}_${from || 'все'}_${to || 'все'}.xlsx`
  XLSX.writeFile(wb, fileName)
}
