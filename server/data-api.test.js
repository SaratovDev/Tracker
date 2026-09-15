import { describe, expect, it, vi } from 'vitest'
import { handleDataRequest, loadData, saveData } from './data-api.js'
import { createMemoryStore } from './data-store.js'
import { createSessionToken, serializeSessionCookie } from './session.js'

const SECRET = 'data-api-test-secret'

const SEED = {
  projects: [{ id: 'p1', name: 'GNSS AE', hourlyRate: 1700, createdAt: 1 }],
  tasks: [
    {
      id: 't1',
      projectId: 'p1',
      title: 'Карточки',
      description: '',
      links: '',
      priority: 'yellow',
      status: 'done',
      totalTimeSeconds: 3600,
      timerStartAt: null,
      completedAt: 2,
      completedDescription: 'Готово',
      createdAt: 1
    }
  ]
}

function authorizedRequest(secret = SECRET) {
  return {
    headers: { cookie: serializeSessionCookie(createSessionToken(secret), { secure: false }) }
  }
}

function get(store, options = {}) {
  return handleDataRequest({ method: 'GET', store, seed: SEED, sessionSecret: SECRET, ...options })
}

function put(store, body, options = {}) {
  return handleDataRequest({
    method: 'PUT',
    body,
    req: authorizedRequest(),
    store,
    seed: SEED,
    sessionSecret: SECRET,
    ...options
  })
}

describe('loadData', () => {
  it('засевает пустое хранилище и записывает туда стартовые данные', async () => {
    const store = createMemoryStore()

    const data = await loadData({ store, seed: SEED })

    expect(data.projects).toHaveLength(1)
    expect(await store.read()).toEqual(SEED)
  })

  it('не затирает намеренно пустые данные стартовыми задачами', async () => {
    const store = createMemoryStore({ projects: [], tasks: [] })

    const data = await loadData({ store, seed: SEED })

    expect(data).toEqual({ projects: [], tasks: [] })
  })

  it('без стартовых данных отдаёт пустой трекер', async () => {
    expect(await loadData({ store: createMemoryStore() })).toEqual({ projects: [], tasks: [] })
  })

  it('второй запрос не подменяет уже сохранённые данные', async () => {
    const store = createMemoryStore()
    await loadData({ store, seed: SEED })

    await store.write({ projects: [], tasks: [] })
    const data = await loadData({ store, seed: SEED })

    expect(data).toEqual({ projects: [], tasks: [] })
  })
})

describe('saveData', () => {
  it('сохраняет валидные данные', async () => {
    const store = createMemoryStore()

    const result = await saveData({ store, input: SEED })

    expect(result.status).toBe(200)
    expect((await store.read()).tasks).toHaveLength(1)
  })

  it('отклоняет невалидные данные и ничего не пишет', async () => {
    const store = createMemoryStore()

    const result = await saveData({ store, input: { projects: [{ id: 'p' }], tasks: [] } })

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('invalid_data')
    expect(await store.read()).toBeNull()
  })
})

describe('GET /api/data', () => {
  it('отдаёт данные всем без авторизации', async () => {
    const result = await get(createMemoryStore())

    expect(result.status).toBe(200)
    expect(result.body.projects).toHaveLength(1)
  })

  it('запрещает кеширование', async () => {
    const result = await get(createMemoryStore())

    expect(result.headers['Cache-Control']).toBe('no-store')
  })

  it('возвращает 500 storage_unavailable при сбое хранилища', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = {
      async read() {
        throw new Error('blob down')
      }
    }

    const result = await get(store)

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('storage_unavailable')
    consoleError.mockRestore()
  })
})

describe('PUT /api/data', () => {
  it('принимает данные от администратора с действующей сессией', async () => {
    const store = createMemoryStore()

    const result = await put(store, { projects: [], tasks: [] })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true })
    expect(await store.read()).toEqual({ projects: [], tasks: [] })
  })

  it('отклоняет запись без cookie сессии', async () => {
    const store = createMemoryStore()

    const result = await handleDataRequest({
      method: 'PUT',
      body: SEED,
      req: { headers: {} },
      store,
      seed: SEED,
      sessionSecret: SECRET
    })

    expect(result.status).toBe(401)
    expect(result.body.error).toBe('unauthorized')
    expect(await store.read()).toBeNull()
  })

  it('отклоняет запись с подделанной cookie', async () => {
    const store = createMemoryStore()

    const result = await put(store, SEED, {
      req: { headers: { cookie: 'tasktracker_session=forged.value' } }
    })

    expect(result.status).toBe(401)
  })

  it('отклоняет запись с сессией, подписанной другим секретом', async () => {
    const store = createMemoryStore()

    const result = await put(store, SEED, { req: authorizedRequest('чужой-секрет') })

    expect(result.status).toBe(401)
  })

  it('отклоняет истёкшую сессию', async () => {
    const store = createMemoryStore()
    const expired = {
      headers: {
        cookie: serializeSessionCookie(
          createSessionToken(SECRET, { now: 1000, ttlSeconds: 60 }),
          { secure: false }
        )
      }
    }

    const result = await put(store, SEED, { req: expired, now: 1000 + 61_000 })

    expect(result.status).toBe(401)
  })

  it('отклоняет невалидное тело, не трогая хранилище', async () => {
    const store = createMemoryStore()

    const result = await put(store, { projects: 'нет', tasks: [] })

    expect(result.status).toBe(400)
    expect(await store.read()).toBeNull()
  })

  it('сообщает о ненастроенном сервере, если нет секрета сессии', async () => {
    const result = await put(createMemoryStore(), SEED, { sessionSecret: undefined })

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('server_not_configured')
  })
})

describe('прочие методы', () => {
  it('отвечает 405 и перечисляет допустимые методы', async () => {
    const result = await handleDataRequest({
      method: 'DELETE',
      store: createMemoryStore(),
      seed: SEED,
      sessionSecret: SECRET
    })

    expect(result.status).toBe(405)
    expect(result.headers.Allow).toBe('GET, PUT')
  })
})
