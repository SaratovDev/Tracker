import { authenticate, getClientIp, readJsonBody } from './auth.js'

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/**
 * Dev-аналог serverless-функции Vercel: тот же путь /api/login и та же логика
 * из server/auth.js, поэтому npm run dev ведёт себя как продакшен.
 */
export function devApiPlugin({ passwordHash } = {}) {
  return {
    name: 'tasktracker-dev-api',
    apply: 'serve',
    configureServer(server) {
      if (!passwordHash && !process.env.VITEST) {
        server.config.logger.warn(
          '\nADMIN_PASSWORD_HASH не задан — вход администратора в dev-режиме недоступен.\n' +
            'Создайте .env из .env.example и выполните:\n' +
            '  npm run hash-password -- "ваш пароль"\n'
        )
      }

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        if (path !== '/api/login') return next()

        if (req.method !== 'POST') {
          return sendJson(res, 405, { error: 'method_not_allowed' })
        }

        const body = await readJsonBody(req)
        const result = authenticate(body?.password, {
          hash: passwordHash,
          clientIp: getClientIp(req)
        })

        if (result.body.retryAfterSeconds) {
          res.setHeader('Retry-After', String(result.body.retryAfterSeconds))
        }
        sendJson(res, result.status, result.body)
      })
    }
  }
}
