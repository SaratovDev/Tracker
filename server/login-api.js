import { authenticate, extractPassword } from './auth.js'
import {
  clearSessionCookie,
  createSessionToken,
  serializeSessionCookie
} from './session.js'

function methodNotAllowed(allow) {
  return { status: 405, body: { error: 'method_not_allowed' }, headers: { Allow: allow } }
}

/**
 * Общая логика входа для Vercel-функции и dev-сервера.
 * При верном пароле выдаёт подписанную HttpOnly-cookie: только по ней
 * PUT /api/data считается авторизованным, роль на клиенте здесь не участвует.
 */
export function handleLoginRequest({
  method,
  body,
  clientIp,
  passwordHash,
  sessionSecret,
  now = Date.now(),
  secure = true
}) {
  if (method !== 'POST') return methodNotAllowed('POST')

  // Без секрета сессии cookie не выпустить, а значит писать данные гость
  // всё равно не сможет — считаем сервер ненастроенным, как и без хеша пароля.
  if (!sessionSecret) return { status: 500, body: { error: 'server_not_configured' } }

  const result = authenticate(extractPassword(body), { hash: passwordHash, clientIp, now })
  if (result.status !== 200) {
    const headers = result.body.retryAfterSeconds
      ? { 'Retry-After': String(result.body.retryAfterSeconds) }
      : undefined
    return { status: result.status, body: result.body, headers }
  }

  return {
    status: 200,
    body: { ok: true },
    headers: { 'Set-Cookie': serializeSessionCookie(createSessionToken(sessionSecret, { now }), { secure }) }
  }
}

export function handleLogoutRequest({ method, secure = true } = {}) {
  if (method !== 'POST') return methodNotAllowed('POST')

  return {
    status: 200,
    body: { ok: true },
    headers: { 'Set-Cookie': clearSessionCookie({ secure }) }
  }
}
