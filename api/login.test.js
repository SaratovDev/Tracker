import { beforeAll, describe, expect, it } from 'vitest'
import handler from './login.js'
import { hashPassword, resetRateLimit } from '../server/auth.js'

const PASSWORD = '0321'

function mockReq({ method = 'POST', body, ip = '203.0.113.1' } = {}) {
  return { method, body, headers: { 'x-forwarded-for': ip }, socket: {} }
}

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

beforeAll(() => {
  process.env.ADMIN_PASSWORD_HASH = hashPassword(PASSWORD, 'api-fixed-salt')
})

describe('POST /api/login', () => {
  it('отклоняет методы кроме POST', () => {
    const res = mockRes()
    handler(mockReq({ method: 'GET' }), res)

    expect(res.statusCode).toBe(405)
    expect(res.payload.error).toBe('method_not_allowed')
  })

  it('принимает верный пароль', () => {
    const res = mockRes()
    handler(mockReq({ body: { password: PASSWORD }, ip: 'ok' }), res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ ok: true })
  })

  it('отклоняет неверный пароль', () => {
    const res = mockRes()
    handler(mockReq({ body: { password: 'wrong' }, ip: 'bad' }), res)

    expect(res.statusCode).toBe(401)
    expect(res.payload.error).toBe('invalid_password')
  })

  it('читает пароль из строкового тела', () => {
    const res = mockRes()
    handler(mockReq({ body: JSON.stringify({ password: PASSWORD }), ip: 'string-body' }), res)

    expect(res.statusCode).toBe(200)
  })

  it('отклоняет запрос без пароля', () => {
    const res = mockRes()
    handler(mockReq({ body: {}, ip: 'no-password' }), res)

    expect(res.statusCode).toBe(401)
  })

  it('отвечает 500, если хеш не настроен', () => {
    const saved = process.env.ADMIN_PASSWORD_HASH
    delete process.env.ADMIN_PASSWORD_HASH

    const res = mockRes()
    handler(mockReq({ body: { password: PASSWORD }, ip: 'not-configured' }), res)

    expect(res.statusCode).toBe(500)
    expect(res.payload.error).toBe('server_not_configured')
    process.env.ADMIN_PASSWORD_HASH = saved
  })

  it('блокирует перебор и отдаёт Retry-After', () => {
    const ip = 'brute-force'
    resetRateLimit(ip)

    for (let i = 0; i < 10; i += 1) {
      const res = mockRes()
      handler(mockReq({ body: { password: 'wrong' }, ip }), res)
      expect(res.statusCode).toBe(401)
    }

    const res = mockRes()
    handler(mockReq({ body: { password: 'wrong' }, ip }), res)

    expect(res.statusCode).toBe(429)
    expect(res.payload.error).toBe('too_many_attempts')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  })
})
