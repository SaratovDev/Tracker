import { beforeEach, describe, expect, it } from 'vitest'
import { hashPassword, resetRateLimit } from './auth.js'
import { handleLoginRequest, handleLogoutRequest } from './login-api.js'
import { SESSION_COOKIE, verifySessionToken } from './session.js'

const SECRET = 'login-api-test-secret'
const IP = '198.51.100.7'
const HASH = hashPassword('0321', 'login-api-fixed-salt')

function login({ method = 'POST', body, sessionSecret = SECRET, secure = true } = {}) {
  return handleLoginRequest({
    method,
    body,
    clientIp: IP,
    passwordHash: HASH,
    sessionSecret,
    secure
  })
}

function cookieValue(setCookie) {
  return setCookie.slice(setCookie.indexOf('=') + 1, setCookie.indexOf(';'))
}

beforeEach(() => {
  resetRateLimit(IP)
})

describe('handleLoginRequest', () => {
  it('отклоняет методы кроме POST', () => {
    const result = login({ method: 'GET' })

    expect(result.status).toBe(405)
    expect(result.headers.Allow).toBe('POST')
  })

  it('считает сервер ненастроенным без секрета сессии', () => {
    const result = login({ body: { password: '0321' }, sessionSecret: null })

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('server_not_configured')
  })

  it('считает сервер ненастроенным без хеша пароля', () => {
    const result = handleLoginRequest({
      method: 'POST',
      body: { password: '0321' },
      clientIp: IP,
      passwordHash: undefined,
      sessionSecret: SECRET
    })

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('server_not_configured')
  })

  it('выдаёт HttpOnly-cookie с действующей сессией при верном пароле', () => {
    const result = login({ body: { password: '0321' } })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true })

    const cookie = result.headers['Set-Cookie']
    expect(cookie).toContain(`${SESSION_COOKIE}=`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Secure')
    expect(verifySessionToken(cookieValue(cookie), SECRET)).toBe(true)
  })

  it('не ставит Secure в dev-режиме, иначе cookie не сохранится по http', () => {
    const result = login({ body: { password: '0321' }, secure: false })

    expect(result.headers['Set-Cookie']).not.toContain('Secure')
  })

  it('не выдаёт cookie при неверном пароле', () => {
    const result = login({ body: { password: '0000' } })

    expect(result.status).toBe(401)
    expect(result.headers).toBeUndefined()
  })

  it('сообщает о лимите попыток и Retry-After', () => {
    for (let i = 0; i < 10; i += 1) login({ body: { password: '0000' } })

    const result = login({ body: { password: '0000' } })

    expect(result.status).toBe(429)
    expect(result.body.error).toBe('too_many_attempts')
    expect(Number(result.headers['Retry-After'])).toBeGreaterThan(0)
  })

  it('без пароля отвечает 401 и не выдаёт cookie', () => {
    const result = login({ body: {} })

    expect(result.status).toBe(401)
    expect(result.headers).toBeUndefined()
  })
})

describe('handleLogoutRequest', () => {
  it('отклоняет методы кроме POST', () => {
    expect(handleLogoutRequest({ method: 'GET' }).status).toBe(405)
  })

  it('гасит cookie сессии', () => {
    const result = handleLogoutRequest({ method: 'POST' })

    expect(result.status).toBe(200)
    expect(result.headers['Set-Cookie']).toContain(`${SESSION_COOKIE}=`)
    expect(result.headers['Set-Cookie']).toContain('Max-Age=0')
  })
})
