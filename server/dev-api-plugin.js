import { fileURLToPath } from 'node:url'
import { getClientIp, readJsonBody } from './auth.js'
import { handleDataRequest } from './data-api.js'
import { MAX_DATA_BYTES } from './data-schema.js'
import { createBlobStore, createFileStore } from './data-store.js'
import { sendNode } from './http.js'
import { handleLoginRequest, handleLogoutRequest } from './login-api.js'
import { getSeed } from './seed.js'

// Локальные данные dev-сервера, чтобы они переживали перезапуск.
// В репозиторий не попадают (см. .gitignore).
const DEV_DATA_FILE = fileURLToPath(new URL('../.dev-data/tasktracker.json', import.meta.url))

/**
 * Dev-аналог serverless-функций Vercel: те же пути /api/login, /api/logout, /api/data
 * и та же логика из server/*.js, поэтому npm run dev ведёт себя как продакшен.
 */
export function devApiPlugin({ passwordHash, sessionSecret, blobToken } = {}) {
  return {
    name: 'tasktracker-dev-api',
    apply: 'serve',
    configureServer(server) {
      const hash = passwordHash || process.env.ADMIN_PASSWORD_HASH
      const secret = sessionSecret || process.env.SESSION_SECRET
      const token = blobToken || process.env.BLOB_READ_WRITE_TOKEN
      const seed = getSeed()

      // Без Blob-стора dev работает с локальным файлом: настраивать Vercel Blob
      // для разработки не нужно.
      const store = token ? createBlobStore({ token }) : createFileStore(DEV_DATA_FILE)

      if (!process.env.VITEST) {
        if (!hash) {
          server.config.logger.warn(
            '\nADMIN_PASSWORD_HASH не задан — вход администратора в dev-режиме недоступен.\n' +
              'Создайте .env из .env.example и выполните:\n' +
              '  npm run hash-password -- "ваш пароль"\n'
          )
        }

        if (!secret) {
          server.config.logger.warn(
            '\nSESSION_SECRET не задан — cookie сессии не выпускается, поэтому сохранять\n' +
              'данные (PUT /api/data) не получится. Создайте секрет командой:\n' +
              '  npm run generate-secret\n'
          )
        }

        if (!token) {
          server.config.logger.info(
            `\nDev-хранилище: ${DEV_DATA_FILE}\n` +
              (seed
                ? `Стартовых данных: ${seed.projects.length} проектов, ${seed.tasks.length} задач.\n`
                : '')
          )
        }
      }

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        if (!path.startsWith('/api/')) return next()

        if (path === '/api/login') {
          const body = await readJsonBody(req)
          return sendNode(
            res,
            handleLoginRequest({
              method: req.method,
              body,
              clientIp: getClientIp(req),
              passwordHash: hash,
              sessionSecret: secret,
              // dev-сервер работает по http: с флагом Secure браузер
              // не сохранил бы cookie сессии
              secure: false
            })
          )
        }

        if (path === '/api/logout') {
          return sendNode(res, handleLogoutRequest({ method: req.method, secure: false }))
        }

        if (path === '/api/data') {
          let body
          if (req.method === 'PUT') {
            if (Number(req.headers['content-length']) > MAX_DATA_BYTES) {
              return sendNode(res, { status: 413, body: { error: 'payload_too_large' } })
            }
            body = await readJsonBody(req, MAX_DATA_BYTES)
          }

          return sendNode(
            res,
            await handleDataRequest({
              method: req.method,
              body,
              req,
              store,
              seed,
              sessionSecret: secret
            })
          )
        }

        return sendNode(res, { status: 404, body: { error: 'not_found' } })
      })
    }
  }
}
