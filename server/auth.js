import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCHEME = 'scrypt'
const KEY_LENGTH = 64
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_ATTEMPTS = 10
const RATE_LIMIT_MAX_KEYS = 5000

// Счётчики попыток держим в памяти процесса. На serverless это защита
// «best effort»: при нескольких инстансах лимит считается по каждому отдельно.
const attempts = new Map()

/**
 * Формат строки: scrypt$<salt>$<hash>. Хранится только на сервере
 * в переменной окружения ADMIN_PASSWORD_HASH.
 */
export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = scryptSync(String(password), salt, KEY_LENGTH, SCRYPT_PARAMS)
  return `${SCHEME}$${salt}$${derived.toString('hex')}`
}

export function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false

  const parts = storedHash.split('$')
  if (parts.length !== 3 || parts[0] !== SCHEME) return false

  const [, salt, expectedHex] = parts
  if (!salt || !expectedHex) return false

  const expected = Buffer.from(expectedHex, 'hex')
  if (expected.length !== KEY_LENGTH) return false

  const actual = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS)
  return timingSafeEqual(expected, actual)
}

function pruneAttempts(now) {
  for (const [key, entry] of attempts) {
    if (now - entry.start > RATE_LIMIT_WINDOW_MS) attempts.delete(key)
  }
}

export function checkRateLimit(key, now = Date.now()) {
  if (attempts.size > RATE_LIMIT_MAX_KEYS) pruneAttempts(now)

  const entry = attempts.get(key)
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    attempts.set(key, { start: now, count: 1 })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  entry.count += 1
  if (entry.count > RATE_LIMIT_MAX_ATTEMPTS) {
    const left = entry.start + RATE_LIMIT_WINDOW_MS - now
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(left / 1000)) }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export function resetRateLimit(key) {
  attempts.delete(key)
}

/**
 * Единая проверка входа: используется и serverless-функцией Vercel,
 * и dev-сервером Vite, чтобы логика не расходилась.
 */
export function authenticate(password, { hash, clientIp = 'unknown', now = Date.now() } = {}) {
  if (!hash) return { status: 500, body: { error: 'server_not_configured' } }

  const limit = checkRateLimit(clientIp, now)
  if (!limit.allowed) {
    return {
      status: 429,
      body: { error: 'too_many_attempts', retryAfterSeconds: limit.retryAfterSeconds }
    }
  }

  if (!verifyPassword(password, hash)) {
    return { status: 401, body: { error: 'invalid_password' } }
  }

  resetRateLimit(clientIp)
  return { status: 200, body: { ok: true } }
}

/** Тело запроса Vercel уже разобрано; строковый вариант встречается при ином Content-Type. */
export function extractPassword(body) {
  if (!body) return undefined
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)?.password
    } catch {
      return undefined
    }
  }
  if (typeof body === 'object') return body.password
  return undefined
}

export function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for']
  if (Array.isArray(forwarded) && forwarded.length) {
    return String(forwarded[0]).split(',')[0].trim()
  }
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req?.socket?.remoteAddress || 'unknown'
}

/** Чтение JSON-тела из обычного Node-запроса (dev-сервер Vite). */
export function readJsonBody(req, limitBytes = 4096) {
  return new Promise((resolve) => {
    let size = 0
    let tooLarge = false
    const chunks = []

    req.on('data', (chunk) => {
      if (tooLarge) return
      size += chunk.length
      if (size > limitBytes) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) return resolve(undefined)
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}
