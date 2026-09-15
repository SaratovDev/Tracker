import { beforeAll, describe, expect, it } from 'vitest'
import handler from './login.js'
import { hashPassword, resetRateLimit } from '../server/auth.js'
import { SESSION_COOKIE, verifySessionToken } from '../server/session.js'

const PASSWORD = '0321'
const SESSION_SECRET = 'api-login-test-secret'

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
  process.env.SESSION_SECRET = SESSION_SECRET
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

  it('выдаёт HttpOnly-cookie сессии при верном пароле', () => {
    const res = mockRes()
    handler(mockReq({ body: { password: PASSWORD }, ip: 'cookie' }), res)

    const cookie = res.headers['set-cookie']
    expect(cookie).toContain(`${SESSION_COOKIE}=`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')

    const token = cookie.slice(cookie.indexOf('=') + 1, cookie.indexOf(';'))
    expect(verifySessionToken(token, SESSION_SECRET)).toBe(true)
  })

  it('не выдаёт cookie при неверном пароле', () => {
    const res = mockRes()
    handler(mockReq({ body: { password: 'wrong' }, ip: 'no-cookie' }), res)

    expect(res.statusCode).toBe(401)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('отвечает 500, если не задан SESSION_SECRET', () => {
    const saved = process.env.SESSION_SECRET
    delete process.env.SESSION_SECRET

    const res = mockRes()
    handler(mockReq({ body: { password: PASSWORD }, ip: 'no-secret' }), res)

    expect(res.statusCode).toBe(500)
    expect(res.payload.error).toBe('server_not_configured')
    process.env.SESSION_SECRET = saved
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
