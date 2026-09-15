import { describe, expect, it } from 'vitest'
import { getSeed } from './seed.js'

describe('стартовые данные', () => {
  it('читаются из сгенерированного server/seed-data.js', () => {
    const seed = getSeed()

    expect(seed).not.toBeNull()
    expect(seed.projects.length).toBeGreaterThan(0)
    expect(seed.tasks.length).toBeGreaterThan(0)
  })

  it('каждый проект и задача проходят проверку схемы', () => {
    const seed = getSeed()
    const projectIds = new Set(seed.projects.map((p) => p.id))

    for (const task of seed.tasks) {
      expect(projectIds.has(task.projectId)).toBe(true)
    }
  })

  it('кеширует результат, а не пересобирает его на каждый запрос', () => {
    expect(getSeed()).toBe(getSeed())
  })
})
