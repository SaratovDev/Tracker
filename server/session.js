import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'tasktracker_session'
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
export const SESSION_ROLE_ADMIN = 'admin'

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function sameSignature(a, b) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Токен сессии администратора: base64url(payload).hmac.
 * Ставится в HttpOnly-cookie, поэтому в JS на странице недоступен.
 */
export function createSessionToken(
  secret,
  { now = Date.now(), ttlSeconds = SESSION_TTL_SECONDS } = {}
) {
  const payload = Buffer.from(
    JSON.stringify({
      role: SESSION_ROLE_ADMIN,
      exp: Math.floor(now / 1000) + ttlSeconds
    })
  ).toString('base64url')

  return `${payload}.${sign(payload, secret)}`
}

export function verifySessionToken(token, secret, { now = Date.now() } = {}) {
  if (typeof token !== 'string' || typeof secret !== 'string' || !secret) return false

  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [payload, signature] = parts
  if (!payload || !signature) return false
  if (!sameSignature(signature, sign(payload, secret))) return false

  let parsed
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return false
  }

  if (!parsed || parsed.role !== SESSION_ROLE_ADMIN) return false
  if (typeof parsed.exp !== 'number') return false
  return parsed.exp * 1000 > now
}

export function parseCookies(header) {
  const cookies = {}
  if (typeof header !== 'string' || !header) return cookies

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue

    const name = part.slice(0, separator).trim()
    if (!name) continue

    const raw = part.slice(separator + 1).trim()
    try {
      cookies[name] = decodeURIComponent(raw)
    } catch {
      cookies[name] = raw
    }
  }

  return cookies
}

export function getCookie(req, name = SESSION_COOKIE) {
  const header = req?.headers?.cookie
  return parseCookies(Array.isArray(header) ? header[0] : header)[name]
}

export function serializeSessionCookie(
  token,
  { maxAge = SESSION_TTL_SECONDS, secure = true } = {}
) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie({ secure = true } = {}) {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0'
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/** Проверка, что запрос пришёл от администратора с действующей сессией. */
export function isAdminRequest(req, secret, { now = Date.now() } = {}) {
  return verifySessionToken(getCookie(req), secret, { now })
}
