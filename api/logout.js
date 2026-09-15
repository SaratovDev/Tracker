import { handleLogoutRequest } from '../server/login-api.js'
import { sendVercel } from '../server/http.js'

/**
 * Serverless-функция Vercel: POST /api/logout
 * Снимает HttpOnly-cookie сессии, чтобы браузер больше не мог писать данные.
 */
export default function handler(req, res) {
  sendVercel(res, handleLogoutRequest({ method: req.method, secure: true }))
}
