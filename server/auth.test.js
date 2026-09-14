import { describe, expect, it } from 'vitest'
import {
  authenticate,
  checkRateLimit,
  extractPassword,
  getClientIp,
  hashPassword,
  resetRateLimit,
  verifyPassword
} from './auth.js'

const PASSWORD = '0321'
const HASH = hashPassword(PASSWORD, 'fixed-salt-for-tests')

const WINDOW_MS = 15 * 60 * 1000

describe('hashPassword и verifyPassword', () => {
  it('пишет хеш в формате scrypt$salt$hash', () => {
    const parts = HASH.split('$')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('scrypt')
  })

  it('для одного пароля даёт разные хеши из-за соли', () => {
    expect(hashPassword(PASSWORD)).not.toBe(hashPassword(PASSWORD))
  })

  it('подтверждает верный пароль', () => {
    expect(verifyPassword(PASSWORD, HASH)).toBe(true)
  })

  it('отклоняет неверный пароль', () => {
    expect(verifyPassword('0000', HASH)).toBe(false)
  })

  it('отклоняет повреждённый или чужой хеш', () => {
    expect(verifyPassword(PASSWORD, '')).toBe(false)
    expect(verifyPassword(PASSWORD, 'plain')).toBe(false)
    expect(verifyPassword(PASSWORD, 'scrypt$only')).toBe(false)
    expect(verifyPassword(PASSWORD, 'scrypt$salt$nothex')).toBe(false)
    expect(verifyPassword(PASSWORD, 'bcrypt$salt$hash')).toBe(false)
  })

  it('не падает, если пароль не строка', () => {
    expect(verifyPassword(123, HASH)).toBe(false)
    expect(verifyPassword(undefined, HASH)).toBe(false)
  })
})

describe('checkRateLimit', () => {
  it('пропускает попытки в пределах лимита', () => {
    const key = 'limit-allow'
    for (let i = 0; i < 10; i += 1) {
      expect(checkRateLimit(key, 1000).allowed).toBe(true)
    }
  })

  it('блокирует после превышения лимита', () => {
    const key = 'limit-block'
    for (let i = 0; i < 10; i += 1) checkRateLimit(key, 1000)

    const blocked = checkRateLimit(key, 1000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('снимает блокировку по истечении окна', () => {
    const key = 'limit-window'
    for (let i = 0; i < 11; i += 1) checkRateLimit(key, 1000)
    expect(checkRateLimit(key, 1000).allowed).toBe(false)

    expect(checkRateLimit(key, 1000 + WINDOW_MS + 1).allowed).toBe(true)
  })

  it('resetRateLimit снимает блокировку', () => {
    const key = 'limit-reset'
    for (let i = 0; i < 11; i += 1) checkRateLimit(key, 1000)
    expect(checkRateLimit(key, 1000).allowed).toBe(false)

    resetRateLimit(key)
    expect(checkRateLimit(key, 1000).allowed).toBe(true)
  })
})

describe('authenticate', () => {
  it('сообщает о ненастроенном сервере, если нет хеша', () => {
    const result = authenticate('0321', { hash: undefined, clientIp: 'no-hash' })
    expect(result.status).toBe(500)
    expect(result.body.error).toBe('server_not_configured')
  })

  it('подтверждает вход с верным паролем', () => {
    const result = authenticate(PASSWORD, { hash: HASH, clientIp: 'ok-ip' })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true })
  })

  it('отклоняет неверный пароль', () => {
    const result = authenticate('0000', { hash: HASH, clientIp: 'bad-ip' })
    expect(result.status).toBe(401)
    expect(result.body.error).toBe('invalid_password')
  })

  it('блокирует перебор пароля', () => {
    const clientIp = 'brute-force-ip'
    for (let i = 0; i < 10; i += 1) {
      expect(authenticate('0000', { hash: HASH, clientIp }).status).toBe(401)
    }

    const blocked = authenticate('0000', { hash: HASH, clientIp })
    expect(blocked.status).toBe(429)
    expect(blocked.body.error).toBe('too_many_attempts')
  })

  it('успешный вход сбрасывает счётчик попыток', () => {
    const clientIp = 'reset-after-success'
    authenticate('0000', { hash: HASH, clientIp })
    expect(authenticate(PASSWORD, { hash: HASH, clientIp }).status).toBe(200)
    expect(authenticate('0000', { hash: HASH, clientIp }).status).toBe(401)
  })
})

describe('extractPassword', () => {
  it('читает пароль из разобранного тела', () => {
    expect(extractPassword({ password: 'abc' })).toBe('abc')
  })

  it('читает пароль из строкового тела', () => {
    expect(extractPassword('{"password":"abc"}')).toBe('abc')
  })

  it('возвращает undefined для пустого или битого тела', () => {
    expect(extractPassword(undefined)).toBeUndefined()
    expect(extractPassword('not json')).toBeUndefined()
    expect(extractPassword({})).toBeUndefined()
  })
})

describe('getClientIp', () => {
  it('берёт первый адрес из x-forwarded-for', () => {
    expect(getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4')
  })

  it('понимает массив заголовков', () => {
    expect(getClientIp({ headers: { 'x-forwarded-for': ['9.9.9.9, 8.8.8.8'] } })).toBe('9.9.9.9')
  })

  it('использует адрес сокета, если заголовка нет', () => {
    expect(getClientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1')
  })

  it('возвращает unknown для пустого запроса', () => {
    expect(getClientIp({})).toBe('unknown')
  })
})
