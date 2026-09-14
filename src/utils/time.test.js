import { describe, expect, it } from 'vitest'
import { formatClock, formatDate, formatDuration } from './time'

describe('formatClock', () => {
  it('форматирует секунды в ММ:СС с ведущими нулями', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(5)).toBe('00:05')
    expect(formatClock(59)).toBe('00:59')
    expect(formatClock(60)).toBe('01:00')
    expect(formatClock(332)).toBe('05:32')
  })

  it('при часе и более добавляет часы', () => {
    expect(formatClock(3600)).toBe('1:00:00')
    expect(formatClock(3926)).toBe('1:05:26')
  })

  it('отрицательные и дробные значения трактуются как ноль/отбрасываются', () => {
    expect(formatClock(-5)).toBe('00:00')
    expect(formatClock(12.9)).toBe('00:12')
  })
})

describe('formatDuration', () => {
  it('форматирует в «X мин» / «X ч Y мин»', () => {
    expect(formatDuration(0)).toBe('0 мин')
    expect(formatDuration(59)).toBe('0 мин')
    expect(formatDuration(332)).toBe('5 мин')
    expect(formatDuration(3926)).toBe('1 ч 5 мин')
  })
})

describe('formatDate', () => {
  it('возвращает дату в формате ДД.ММ.ГГГГ', () => {
    expect(formatDate(new Date('2026-08-11T10:00:00Z').getTime())).toBe('11.08.2026')
    expect(formatDate(null)).toBe('—')
  })
})
