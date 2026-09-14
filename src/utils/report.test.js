import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as XLSX from 'xlsx'
import { buildReport, exportReportXlsx, inRange, round2 } from './report'

const createdFiles = []

afterEach(() => {
  for (const f of createdFiles.splice(0)) {
    try {
      fs.rmSync(f)
    } catch {
      /* файл мог не создаться */
    }
  }
})

function makeTask(overrides = {}) {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'Задача',
    description: '',
    links: '',
    priority: 'yellow',
    status: 'done',
    totalTimeSeconds: 3600,
    timerStartAt: null,
    completedAt: new Date('2026-08-10T12:00:00').getTime(),
    completedDescription: 'Готово',
    createdAt: 1,
    ...overrides
  }
}

describe('buildReport', () => {
  it('отбирает только done-задачи и считает часы/стоимость с округлением до 2 знаков', () => {
    const tasks = [
      makeTask({ id: 'a', totalTimeSeconds: 3600, hourlyRate: 3000 }),
      makeTask({ id: 'b', totalTimeSeconds: 5400 }), // 1.5 ч
      makeTask({ id: 'c', status: 'paused' }), // не done — не попадает
      makeTask({ id: 'd', completedAt: null }) // не завершена — не попадает
    ]
    const rows = buildReport(tasks, 'p1', 3000, '', '')
    expect(rows).toHaveLength(2)
    expect(rows[0].hours).toBe(1)
    expect(rows[0].cost).toBe(3000)
    expect(rows[1].hours).toBe(1.5)
    expect(rows[1].cost).toBe(4500)
  })

  it('округляет часы до 2 знаков (25 минут = 0.42 ч)', () => {
    const rows = buildReport([makeTask({ totalTimeSeconds: 1500 })], 'p1', 3000, '', '')
    expect(rows[0].hours).toBe(0.42)
    expect(rows[0].cost).toBe(1260)
  })

  it('фильтрует по диапазону дат включительно', () => {
    const tasks = [
      makeTask({ id: 'a', completedAt: new Date('2026-08-10T23:59:00').getTime() }),
      makeTask({ id: 'b', completedAt: new Date('2026-08-11T00:01:00').getTime() }),
      makeTask({ id: 'c', completedAt: new Date('2026-08-15T12:00:00').getTime() })
    ]
    const rows = buildReport(tasks, 'p1', 3000, '2026-08-11', '2026-08-11')
    expect(rows.map((r) => r.task.id)).toEqual(['b'])
  })

  it('сортирует по дате завершения', () => {
    const tasks = [
      makeTask({ id: 'later', completedAt: new Date('2026-08-12').getTime() }),
      makeTask({ id: 'earlier', completedAt: new Date('2026-08-10').getTime() })
    ]
    const rows = buildReport(tasks, 'p1', 3000, '', '')
    expect(rows.map((r) => r.task.id)).toEqual(['earlier', 'later'])
  })
})

describe('inRange', () => {
  const ts = new Date('2026-08-11T12:00:00').getTime()
  it('границы включительно', () => {
    expect(inRange(ts, '2026-08-11', '2026-08-11')).toBe(true)
    expect(inRange(ts, '2026-08-10', '2026-08-12')).toBe(true)
  })
  it('вне диапазона', () => {
    expect(inRange(ts, '2026-08-12', '2026-08-13')).toBe(false)
    expect(inRange(ts, '2026-08-09', '2026-08-10')).toBe(false)
  })
  it('пустые границы = без фильтра', () => {
    expect(inRange(ts, '', '')).toBe(true)
    expect(inRange(ts, '', '2026-08-10')).toBe(false)
    expect(inRange(ts, '2026-08-12', '')).toBe(false)
  })
})

describe('round2', () => {
  it('округляет до 2 знаков', () => {
    expect(round2(0.4166)).toBe(0.42)
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2)).toBe(2)
  })
})

describe('exportReportXlsx', () => {
  it('создаёт xlsx с шапкой, строками и итогом', () => {
    const project = { id: 'p1', name: 'Сайт заказчика', hourlyRate: 3000 }
    const rows = buildReport(
      [
        makeTask({ id: 'a', title: 'Главная', totalTimeSeconds: 3600, completedDescription: 'Готово' }),
        makeTask({
          id: 'b',
          title: 'Страница услуг',
          totalTimeSeconds: 5400,
          completedDescription: 'Свёрстана'
        })
      ],
      'p1',
      3000,
      '',
      ''
    )

    exportReportXlsx(project, rows, '2026-08-10', '2026-08-11')

    const fileName = 'Отчёт_Сайт заказчика_2026-08-10_2026-08-11.xlsx'
    createdFiles.push(fileName)
    expect(fs.existsSync(fileName)).toBe(true)

    const wb = XLSX.readFile(fileName)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

    // шапка: название проекта, период, ставка
    expect(data[0]).toEqual(['Название проекта', 'Сайт заказчика'])
    expect(data[1]).toEqual(['Период', '2026-08-10 — 2026-08-11'])
    expect(data[2]).toEqual(['Часовая ставка, руб/час', 3000])
    // заголовки таблицы
    expect(data[4]).toEqual(['Задача', 'Приоритет', 'Что выполнено', 'Время (ч)', 'Стоимость'])
    // строки задач
    expect(data[5][0]).toBe('Главная')
    expect(data[5][3]).toBe(1)
    expect(data[5][4]).toBe(3000)
    expect(data[6][0]).toBe('Страница услуг')
    expect(data[6][3]).toBe(1.5)
    expect(data[6][4]).toBe(4500)
    // итог
    expect(data[8][0]).toBe('Итого')
    expect(data[8][3]).toBe(2.5)
    expect(data[8][4]).toBe(7500)
  })

  it('экранирует недопустимые символы в имени файла', () => {
    const project = { id: 'p1', name: 'Сайт: "VIP" / Корп?', hourlyRate: 1000 }
    exportReportXlsx(project, [], '', '')
    const file = fs
      .readdirSync('.')
      .find((f) => f.startsWith('Отчёт_Сайт') && f.endsWith('.xlsx'))
    createdFiles.push(file)
    expect(file).toBeTruthy()
    expect(file).not.toMatch(/[:*?"<>|/]/)
  })
})
