import { defineStore } from 'pinia'

import { login as requestLogin } from '../api/auth.api'
import { authSessionStorage } from './authStorage'

const INVALID_AUTH_RESPONSE_CODE = 'ERR_INVALID_AUTH_RESPONSE'

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isSessionExpired(expiresAt, now = Date.now()) {
  const expiresAtTimestamp = Date.parse(expiresAt)

  return !Number.isFinite(expiresAtTimestamp) || expiresAtTimestamp <= now
}

function normalizeSession(session) {
  if (!isObject(session)) {
    return null
  }

  const token = typeof session.token === 'string' ? session.token.trim() : ''
  const expiresAt = session.expires_at
  const user = session.user

  if (!token || typeof expiresAt !== 'string' || !isObject(user)) {
    return null
  }

  if (isSessionExpired(expiresAt)) {
    return null
  }

  return {
    token,
    expiresAt,
    user,
  }
}

function createInvalidAuthResponseError() {
  const error = new Error('Authentication response does not contain a valid session.')
  error.code = INVALID_AUTH_RESPONSE_CODE

  return error
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null,
    expiresAt: null,
    user: null,
  }),

  getters: {
    isAuthenticated(state) {
      return Boolean(
        state.token && state.user && state.expiresAt && !isSessionExpired(state.expiresAt),
      )
    },
  },

  actions: {
    async login(credentials) {
      this.logout()

      const response = await requestLogin(credentials)
      const session = normalizeSession(response?.data)

      if (!session) {
        this.logout()
        throw createInvalidAuthResponseError()
      }

      this.$patch(session)
      authSessionStorage.save({
        token: session.token,
        expires_at: session.expiresAt,
        user: session.user,
      })

      return response
    },

    logout() {
      this.$patch({
        token: null,
        expiresAt: null,
        user: null,
      })
      authSessionStorage.clear()
    },

    restoreSession() {
      const session = normalizeSession(authSessionStorage.load())

      if (!session) {
        this.logout()
        return false
      }

      this.$patch(session)
      return true
    },
  },
})
