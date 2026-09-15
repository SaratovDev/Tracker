import { describe, expect, it } from 'vitest'
import handler from './logout.js'
import { SESSION_COOKIE } from '../server/session.js'

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    payload: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    }
  }
}

describe('POST /api/logout', () => {
  it('гасит cookie сессии', () => {
    const res = mockRes()
    handler({ method: 'POST' }, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ ok: true })
    expect(res.headers['set-cookie']).toContain(`${SESSION_COOKIE}=`)
    expect(res.headers['set-cookie']).toContain('Max-Age=0')
    expect(res.headers['set-cookie']).toContain('HttpOnly')
  })

  it('отклоняет методы кроме POST', () => {
    const res = mockRes()
    handler({ method: 'GET' }, res)

    expect(res.statusCode).toBe(405)
    expect(res.headers.allow).toBe('POST')
  })
})
