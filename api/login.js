import { authenticate, extractPassword, getClientIp } from '../server/auth.js'

/**
 * Serverless-функция Vercel: POST /api/login
 * Пароль сверяется только на сервере, поэтому в клиентский бандл не попадает.
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const result = authenticate(extractPassword(req.body), {
    hash: process.env.ADMIN_PASSWORD_HASH,
    clientIp: getClientIp(req)
  })

  if (result.body.retryAfterSeconds) {
    res.setHeader('Retry-After', String(result.body.retryAfterSeconds))
  }

  res.status(result.status).json(result.body)
}
