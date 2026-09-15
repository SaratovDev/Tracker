import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './data.js'
import { getSeed } from '../server/seed.js'
import { createSessionToken, serializeSessionCookie } from '../server/session.js'

vi.mock('@vercel/blob', () => ({ get: vi.fn(), put: vi.fn() }))

const { get, put } = await import('@vercel/blob')

const SECRET = 'api-data-test-secret'

function mockReq({ method = 'GET', body, cookie } = {}) {
  return { method, body, headers: cookie ? { cookie } : {} }
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    payload: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    }
  }
}

function adminCookie(secret = SECRET) {
  return serializeSessionCookie(createSessionToken(secret), { secure: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SESSION_SECRET = SECRET
  get.mockResolvedValue(null)
  put.mockResolvedValue({})
})

describe('GET /api/data', () => {
  it('на пустом хранилище отдаёт стартовые задачи и сохраняет их', async () => {
    const seed = getSeed()
    const res = mockRes()

    await handler(mockReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.payload.projects).toHaveLength(seed.projects.length)
    expect(res.payload.tasks).toHaveLength(seed.tasks.length)
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('запрещает кеширование ответа', async () => {
    const res = mockRes()
    await handler(mockReq(), res)

    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('отдаёт сохранённые данные, не подставляя стартовые', async () => {
    get.mockResolvedValue({
      statusCode: 200,
      stream: new Response(JSON.stringify({ projects: [], tasks: [] })).body
    })

    const res = mockRes()
    await handler(mockReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ projects: [], tasks: [] })
    expect(put).not.toHaveBeenCalled()
  })

  it('отвечает 500, если хранилище недоступно', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    get.mockRejectedValue(new Error('blob down'))

    const res = mockRes()
    await handler(mockReq(), res)

    expect(res.statusCode).toBe(500)
    expect(res.payload.error).toBe('storage_unavailable')
    consoleError.mockRestore()
  })
})

describe('PUT /api/data', () => {
  it('сохраняет данные администратора', async () => {
    const payload = { projects: [], tasks: [] }
    const res = mockRes()

    await handler(mockReq({ method: 'PUT', body: payload, cookie: adminCookie() }), res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ ok: true })
    expect(put).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(payload),
      expect.objectContaining({ access: 'private' })
    )
  })

  it('отклоняет запись без сессии', async () => {
    const res = mockRes()

    await handler(mockReq({ method: 'PUT', body: { projects: [], tasks: [] } }), res)

    expect(res.statusCode).toBe(401)
    expect(res.payload.error).toBe('unauthorized')
    expect(put).not.toHaveBeenCalled()
  })

  it('отклоняет запись с чужой подписью', async () => {
    const res = mockRes()

    await handler(
      mockReq({
        method: 'PUT',
        body: { projects: [], tasks: [] },
        cookie: adminCookie('чужой-секрет')
      }),
      res
    )

    expect(res.statusCode).toBe(401)
    expect(put).not.toHaveBeenCalled()
  })

  it('отклоняет невалидное тело', async () => {
    const res = mockRes()

    await handler(mockReq({ method: 'PUT', body: { projects: 'нет' }, cookie: adminCookie() }), res)

    expect(res.statusCode).toBe(400)
    expect(res.payload.error).toBe('invalid_data')
    expect(put).not.toHaveBeenCalled()
  })

  it('без SESSION_SECRET запись невозможна', async () => {
    delete process.env.SESSION_SECRET

    const res = mockRes()
    await handler(mockReq({ method: 'PUT', body: { projects: [], tasks: [] } }), res)

    expect(res.statusCode).toBe(500)
    expect(res.payload.error).toBe('server_not_configured')
  })
})

describe('прочие методы', () => {
  it('отвечает 405 на DELETE и POST', async () => {
    for (const method of ['DELETE', 'POST']) {
      const res = mockRes()
      await handler(mockReq({ method }), res)

      expect(res.statusCode).toBe(405)
      expect(res.headers.allow).toBe('GET, PUT')
    }
  })
})
