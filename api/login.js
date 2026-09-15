import { getClientIp } from '../server/auth.js'
import { handleLoginRequest } from '../server/login-api.js'
import { sendVercel } from '../server/http.js'

/**
 * Serverless-функция Vercel: POST /api/login
 * Пароль сверяется только на сервере, поэтому в клиентский бандл не попадает.
 * При успехе выдаёт HttpOnly-cookie сессии — по ней потом принимается PUT /api/data.
 */
export default function handler(req, res) {
  sendVercel(
    res,
    handleLoginRequest({
      method: req.method,
      body: req.body,
      clientIp: getClientIp(req),
      passwordHash: process.env.ADMIN_PASSWORD_HASH,
      sessionSecret: process.env.SESSION_SECRET,
      secure: true
    })
  )
}
