import { describe, expect, it } from 'vitest'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  createSessionToken,
  getCookie,
  isAdminRequest,
  parseCookies,
  serializeSessionCookie,
  verifySessionToken
} from './session.js'

const SECRET = 'test-secret-not-used-in-production'

describe('токен сессии', () => {
  it('подтверждает токен, выпущенный с тем же секретом', () => {
    const token = createSessionToken(SECRET, { now: 1000 })
    expect(verifySessionToken(token, SECRET, { now: 2000 })).toBe(true)
  })

  it('отклоняет токен с другим секретом', () => {
    const token = createSessionToken(SECRET, { now: 1000 })
    expect(verifySessionToken(token, 'another-secret', { now: 2000 })).toBe(false)
  })

  it('отклоняет подделку payload без верной подписи', () => {
    const forged = Buffer.from(
      JSON.stringify({ role: 'admin', exp: 9999999999 })
    ).toString('base64url')

    expect(verifySessionToken(`${forged}.not-a-signature`, SECRET, { now: 1000 })).toBe(false)
    expect(verifySessionToken(`${forged}.`, SECRET, { now: 1000 })).toBe(false)
  })

  it('отклоняет истёкший токен', () => {
    const token = createSessionToken(SECRET, { now: 1000, ttlSeconds: 60 })
    expect(verifySessionToken(token, SECRET, { now: 1000 + 61_000 })).toBe(false)
  })

  it('учитывает TTL по умолчанию', () => {
    const token = createSessionToken(SECRET, { now: 1000 })
    const almostExpired = 1000 + SESSION_TTL_SECONDS * 1000 - 1
    expect(verifySessionToken(token, SECRET, { now: almostExpired })).toBe(true)
    expect(verifySessionToken(token, SECRET, { now: almostExpired + 1 })).toBe(false)
  })

  it('не падает на мусоре вместо токена или секрета', () => {
    expect(verifySessionToken('', SECRET)).toBe(false)
    expect(verifySessionToken('one.two.three', SECRET)).toBe(false)
    expect(verifySessionToken('%%%.###', SECRET)).toBe(false)
    expect(verifySessionToken(undefined, SECRET)).toBe(false)
    expect(verifySessionToken(createSessionToken(SECRET), '')).toBe(false)
    expect(verifySessionToken(createSessionToken(SECRET), undefined)).toBe(false)
  })

  it('отклоняет валидно подписанный, но неверный payload', () => {
    const payload = Buffer.from(JSON.stringify({ role: 'guest', exp: 9999999999 })).toString(
      'base64url'
    )
    const signature = createSessionToken(SECRET).split('.')[1]
    const token = `${payload}.${signature}`

    expect(verifySessionToken(token, SECRET, { now: 1000 })).toBe(false)
  })
})

describe('cookies', () => {
  it('разбирает строку Cookie с несколькими парами', () => {
    expect(parseCookies('a=1; tasktracker_session=abc; b=2')).toEqual({
      a: '1',
      tasktracker_session: 'abc',
      b: '2'
    })
  })

  it('возвращает пустой объект для отсутствующего заголовка', () => {
    expect(parseCookies(undefined)).toEqual({})
    expect(parseCookies('')).toEqual({})
  })

  it('не падает на частях без «=» и на битом percent-encoding', () => {
    expect(parseCookies('broken; a=1')).toEqual({ a: '1' })
    expect(parseCookies('a=%E0%A4%A')).toEqual({ 'a': '%E0%A4%A' })
  })

  it('читает cookie из заголовков запроса, включая массив', () => {
    expect(getCookie({ headers: { cookie: 'tasktracker_session=abc' } })).toBe('abc')
    expect(getCookie({ headers: { cookie: ['tasktracker_session=xyz'] } })).toBe('xyz')
    expect(getCookie({ headers: {} })).toBeUndefined()
    expect(getCookie({})).toBeUndefined()
  })

  it('ставит HttpOnly, SameSite и Secure в production-режиме', () => {
    const cookie = serializeSessionCookie('tok', { secure: true })
    expect(cookie).toContain(`${SESSION_COOKIE}=tok`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('Path=/')
  })

  it('не ставит Secure в dev, иначе cookie не сохранилась бы по http', () => {
    expect(serializeSessionCookie('tok', { secure: false })).not.toContain('Secure')
  })

  it('очистка cookie обнуляет Max-Age', () => {
    expect(clearSessionCookie()).toContain('Max-Age=0')
  })
})

describe('isAdminRequest', () => {
  const req = (token) => ({ headers: { cookie: `${SESSION_COOKIE}=${token}` } })

  it('пропускает запрос с действующей сессией', () => {
    const token = createSessionToken(SECRET, { now: 1000 })
    expect(isAdminRequest(req(token), SECRET, { now: 2000 })).toBe(true)
  })

  it('отклоняет запрос без cookie и с чужой подписью', () => {
    expect(isAdminRequest({ headers: {} }, SECRET)).toBe(false)
    expect(isAdminRequest(req('broken'), SECRET)).toBe(false)
    expect(isAdminRequest({ headers: { cookie: 'other=1' } }, SECRET)).toBe(false)
  })
})
