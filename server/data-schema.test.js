import { describe, expect, it } from 'vitest'
import { MAX_ITEMS, emptyData, validateData } from './data-schema.js'

function project(overrides = {}) {
  return { id: 'p1', name: 'Сайт', hourlyRate: 3000, createdAt: 1, ...overrides }
}

function task(overrides = {}) {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'Задача',
    description: 'Описание',
    links: '',
    priority: 'yellow',
    status: 'todo',
    totalTimeSeconds: 0,
    timerStartAt: null,
    completedAt: null,
    completedDescription: '',
    createdAt: 1,
    ...overrides
  }
}

describe('validateData', () => {
  it('принимает корректные данные', () => {
    const result = validateData({ projects: [project()], tasks: [task()] })

    expect(result.ok).toBe(true)
    expect(result.value.projects).toHaveLength(1)
    expect(result.value.tasks).toHaveLength(1)
  })

  it('принимает пустые массивы — это легальное состояние', () => {
    expect(validateData(emptyData())).toEqual({ ok: true, value: { projects: [], tasks: [] } })
  })

  it('отбрасывает поля, которых нет в схеме', () => {
    const result = validateData({
      projects: [project({ secret: 'лишнее' })],
      tasks: [task({ hacked: true })],
      extra: 'мусор'
    })

    expect(result.ok).toBe(true)
    expect(result.value.projects[0]).not.toHaveProperty('secret')
    expect(result.value.tasks[0]).not.toHaveProperty('hacked')
    expect(result.value).not.toHaveProperty('extra')
  })

  it('не меняет входной объект', () => {
    const input = { projects: [project()], tasks: [task({ description: undefined })] }
    validateData(input)

    expect(input.tasks[0].description).toBeUndefined()
  })

  it('отклоняет данные не-объект и без нужных массивов', () => {
    expect(validateData(null).ok).toBe(false)
    expect(validateData('строка').ok).toBe(false)
    expect(validateData([]).ok).toBe(false)
    expect(validateData({}).ok).toBe(false)
    expect(validateData({ projects: [], tasks: {} }).ok).toBe(false)
  })

  it('отклоняет проект без id, с плохим названием или ставкой', () => {
    expect(validateData({ projects: [{ name: 'A' }], tasks: [] }).ok).toBe(false)
    expect(validateData({ projects: [project({ id: '' })], tasks: [] }).ok).toBe(false)
    expect(validateData({ projects: [project({ name: 5 })], tasks: [] }).ok).toBe(false)
    expect(validateData({ projects: [project({ hourlyRate: -1 })], tasks: [] }).ok).toBe(false)
    expect(validateData({ projects: [project({ hourlyRate: 'дорого' })], tasks: [] }).ok).toBe(false)
    expect(validateData({ projects: ['строка'], tasks: [] }).ok).toBe(false)
  })

  it('отклоняет задачу без projectId, с чужим статусом или приоритетом', () => {
    expect(validateData({ projects: [project()], tasks: [task({ projectId: '' })] }).ok).toBe(false)
    expect(validateData({ projects: [project()], tasks: [task({ status: 'unknown' })] }).ok).toBe(
      false
    )
    expect(validateData({ projects: [project()], tasks: [task({ priority: 'pink' })] }).ok).toBe(
      false
    )
    expect(validateData({ projects: [project()], tasks: [task({ status: undefined })] }).ok).toBe(
      false
    )
  })

  it('дополняет отсутствующие необязательные поля значениями по умолчанию', () => {
    const result = validateData({
      projects: [project({ createdAt: undefined })],
      tasks: [{ id: 't1', projectId: 'p1', title: 'A', status: 'done', priority: 'red' }]
    })

    expect(result.ok).toBe(true)
    const cleaned = result.value.tasks[0]
    expect(cleaned.description).toBe('')
    expect(cleaned.links).toBe('')
    expect(cleaned.completedDescription).toBe('')
    expect(cleaned.totalTimeSeconds).toBe(0)
    expect(cleaned.timerStartAt).toBeNull()
    expect(cleaned.completedAt).toBeNull()
    expect(typeof result.value.projects[0].createdAt).toBe('number')
  })

  it('приводит отрицательное и дробное время к целому неотрицательному', () => {
    const result = validateData({
      projects: [project()],
      tasks: [task({ totalTimeSeconds: -12.7 }), task({ id: 't2', totalTimeSeconds: 12.7 })]
    })

    expect(result.value.tasks[0].totalTimeSeconds).toBe(0)
    expect(result.value.tasks[1].totalTimeSeconds).toBe(12)
  })

  it('отклоняет слишком длинные строки', () => {
    expect(validateData({ projects: [project({ name: 'a'.repeat(500) })], tasks: [] }).ok).toBe(
      false
    )
    expect(
      validateData({ projects: [project()], tasks: [task({ title: 'a'.repeat(5000) })] }).ok
    ).toBe(false)
  })

  it('ограничивает количество записей', () => {
    const many = Array.from({ length: MAX_ITEMS + 1 }, (_, i) => project({ id: `p${i}` }))
    const result = validateData({ projects: many, tasks: [] })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/не поддерживается/)
  })

  it('сообщает понятную причину отказа', () => {
    const result = validateData({ projects: [project()], tasks: [task({ status: 'wrong' })] })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('статус')
    expect(result.error).toContain('Задача')
  })
})
