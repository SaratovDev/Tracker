import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ROLE_KEY, useAuthStore } from './auth'

const storeData = new Map()

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  }
}

beforeEach(() => {
  storeData.clear()
  globalThis.localStorage = {
    getItem: (k) => (storeData.has(k) ? storeData.get(k) : null),
    setItem: (k, v) => storeData.set(k, String(v)),
    removeItem: (k) => storeData.delete(k)
  }
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('роли', () => {
  it('по умолчанию роль не выбрана', () => {
    const auth = useAuthStore()
    expect(auth.role).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.isAdmin).toBe(false)
    expect(auth.isGuest).toBe(false)
  })

  it('вход гостем не требует пароля и сохраняется в localStorage', () => {
    const auth = useAuthStore()
    auth.loginGuest()

    expect(auth.role).toBe('guest')
    expect(auth.isGuest).toBe(true)
    expect(auth.isAdmin).toBe(false)
    expect(storeData.get(ROLE_KEY)).toBe('guest')
  })

  it('вход админом уходит на сервер и не хранит пароль на клиенте', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const auth = useAuthStore()
    const result = await auth.loginAdmin('0321')

    expect(result).toEqual({ ok: true })
    expect(auth.role).toBe('admin')
    expect(auth.isAdmin).toBe(true)
    expect(storeData.get(ROLE_KEY)).toBe('admin')
    expect(fetchMock).toHaveBeenCalledWith('/api/login', expect.objectContaining({ method: 'POST' }))
  })

  it('неверный пароль не даёт прав', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { error: 'invalid_password' })))

    const auth = useAuthStore()
    const result = await auth.loginAdmin('0000')

    expect(result).toEqual({ ok: false, reason: 'invalid' })
    expect(auth.role).toBeNull()
    expect(storeData.has(ROLE_KEY)).toBe(false)
  })

  it('сообщает о превышении числа попыток', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(429, { error: 'too_many_attempts', retryAfterSeconds: 600 }))
    )

    const auth = useAuthStore()
    const result = await auth.loginAdmin('0000')

    expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 600 })
    expect(auth.role).toBeNull()
  })

  it('сообщает о недоступном сервере авторизации', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )

    const auth = useAuthStore()
    const result = await auth.loginAdmin('0321')

    expect(result).toEqual({ ok: false, reason: 'unavailable' })
    expect(auth.role).toBeNull()
    consoleError.mockRestore()
  })

  it('сообщает о ненастроенном сервере (500)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500, { error: 'server_not_configured' })))

    const auth = useAuthStore()
    const result = await auth.loginAdmin('0321')

    expect(result).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('снимает флаг проверки пароля после ответа', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, {})))

    const auth = useAuthStore()
    const pending = auth.loginAdmin('0000')
    expect(auth.checkingPassword).toBe(true)
    await pending
    expect(auth.checkingPassword).toBe(false)
  })

  it('restore восстанавливает ранее выбранную роль', () => {
    storeData.set(ROLE_KEY, 'admin')
    const auth = useAuthStore()
    auth.restore()

    expect(auth.role).toBe('admin')
    expect(auth.isAdmin).toBe(true)
  })

  it('restore игнорирует повреждённое значение', () => {
    storeData.set(ROLE_KEY, 'superuser')
    const auth = useAuthStore()
    auth.restore()

    expect(auth.role).toBeNull()
  })

  it('logout сбрасывает роль и очищает хранилище', () => {
    const auth = useAuthStore()
    auth.loginGuest()
    auth.logout()

    expect(auth.role).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(storeData.has(ROLE_KEY)).toBe(false)
  })
})
