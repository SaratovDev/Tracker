import { defineStore } from 'pinia'

export const ROLE_KEY = 'tasktracker_role'

export const ROLE_ADMIN = 'admin'
export const ROLE_GUEST = 'guest'

const VALID_ROLES = [ROLE_ADMIN, ROLE_GUEST]

function readRole() {
  try {
    const role = localStorage.getItem(ROLE_KEY)
    return VALID_ROLES.includes(role) ? role : null
  } catch (err) {
    console.error('Не удалось прочитать роль:', err)
    return null
  }
}

async function readErrorPayload(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    role: null,
    checkingPassword: false
  }),

  getters: {
    isAdmin: (state) => state.role === ROLE_ADMIN,
    isGuest: (state) => state.role === ROLE_GUEST,
    isAuthenticated: (state) => state.role != null
  },

  actions: {
    /** Восстановление выбранной роли при загрузке приложения */
    restore() {
      this.role = readRole()
    },

    setRole(role) {
      if (!VALID_ROLES.includes(role)) return
      this.role = role
      try {
        localStorage.setItem(ROLE_KEY, role)
      } catch (err) {
        console.error('Не удалось сохранить роль:', err)
      }
    },

    loginGuest() {
      this.setRole(ROLE_GUEST)
    },

    /**
     * Пароль проверяется на сервере (POST /api/login), в бандл не попадает.
     * Возвращает { ok: true } либо { ok: false, reason }.
     */
    async loginAdmin(password) {
      this.checkingPassword = true
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        })

        if (response.ok) {
          this.setRole(ROLE_ADMIN)
          return { ok: true }
        }

        if (response.status === 401) return { ok: false, reason: 'invalid' }

        if (response.status === 429) {
          const payload = await readErrorPayload(response)
          return {
            ok: false,
            reason: 'rate_limited',
            retryAfterSeconds: payload?.retryAfterSeconds
          }
        }

        console.error(`Сервер авторизации недоступен (HTTP ${response.status}).`)
        return { ok: false, reason: 'unavailable' }
      } catch (err) {
        console.error('Не удалось проверить пароль:', err)
        return { ok: false, reason: 'unavailable' }
      } finally {
        this.checkingPassword = false
      }
    },

    logout() {
      this.role = null
      try {
        localStorage.removeItem(ROLE_KEY)
      } catch (err) {
        console.error('Не удалось сбросить роль:', err)
      }
    }
  }
})
