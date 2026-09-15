import { emptyData, validateData } from './data-schema.js'
import { isAdminRequest } from './session.js'

/**
 * Ответ в стиле Vercel-функции: res.status(code).json(body).
 */
export function sendVercel(res, { status, body, headers }) {
  for (const [name, value] of Object.entries(headers || {})) res.setHeader(name, value)
  res.status(status).json(body)
}

/**
 * Ответ в стиле обычного Node-сервера (dev-плагин Vite).
 */
export function sendNode(res, { status, body, headers }) {
  for (const [name, value] of Object.entries(headers || {})) res.setHeader(name, value)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

/**
 * Ответ для сред на стандартном Response (Netlify Functions API v2).
 */
export function sendWebResponse({ status, body, headers }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(headers || {}) }
  })
}
