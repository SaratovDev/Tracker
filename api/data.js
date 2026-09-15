import { handleDataRequest } from '../server/data-api.js'
import { createBlobStore } from '../server/data-store.js'
import { getSeed } from '../server/seed.js'
import { sendVercel } from '../server/http.js'

/**
 * Serverless-функция Vercel: /api/data
 * GET — отдаёт задачи всем (гость должен их видеть).
 * PUT — принимает данные только с действующей сессией администратора.
 */
export default async function handler(req, res) {
  const result = await handleDataRequest({
    method: req.method,
    body: req.body,
    req,
    store: createBlobStore({ token: process.env.BLOB_READ_WRITE_TOKEN }),
    seed: getSeed(),
    sessionSecret: process.env.SESSION_SECRET
  })

  sendVercel(res, result)
}
