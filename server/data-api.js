import { emptyData, validateData } from './data-schema.js'
import { isAdminRequest } from './session.js'

/**
 * Чтение данных с ленивым посевом. Если в хранилище ещё нет записи,
 * туда кладётся снапшот из server/seed-data.js и возвращается он же.
 *
 * Посев возможен только один раз: «пустой трекер» (projects: [], tasks: [])
 * это тоже сохранённое состояние, поэтому намеренно удалённые задачи
 * после перезагрузки страницы не вернутся.
 */
export async function loadData({ store, seed = null }) {
  const existing = await store.read()
  if (existing) return existing
  if (!seed) return emptyData()

  await store.write(seed)
  return seed
}

export async function saveData({ store, input }) {
  const result = validateData(input)
  if (!result.ok) {
    return { status: 400, body: { error: 'invalid_data', message: result.error } }
  }

  await store.write(result.value)
  return { status: 200, body: { ok: true } }
}

/**
 * Общая логика /api/data для Vercel-функции и dev-сервера.
 * GET отдаётся всем (гость видит задачи), PUT — только с действующей
 * сессией администратора.
 */
export async function handleDataRequest({
  method,
  body,
  req,
  store,
  seed = null,
  sessionSecret,
  now = Date.now()
}) {
  try {
    if (method === 'GET') {
      return {
        status: 200,
        body: await loadData({ store, seed }),
        headers: { 'Cache-Control': 'no-store' }
      }
    }

    if (method === 'PUT') {
      if (!sessionSecret) return { status: 500, body: { error: 'server_not_configured' } }

      if (!isAdminRequest(req, sessionSecret, { now })) {
        return { status: 401, body: { error: 'unauthorized' } }
      }

      return await saveData({ store, input: body })
    }

    return {
      status: 405,
      body: { error: 'method_not_allowed' },
      headers: { Allow: 'GET, PUT' }
    }
  } catch (err) {
    console.error('Ошибка хранилища данных:', err)
    return { status: 500, body: { error: 'storage_unavailable' } }
  }
}
