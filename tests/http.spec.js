import axios from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installAuthInterceptors } from '../src/api/http'
import { useAuthStore } from '../src/stores/auth'
import { AUTH_STORAGE_KEY, authSessionStorage } from '../src/stores/authStorage'

function createSuccessfulClient() {
  return axios.create({
    adapter: async (config) => ({
      config,
      data: null,
      headers: {},
      status: 200,
      statusText: 'OK',
    }),
  })
}

function createErrorClient(status) {
  return axios.create({
    adapter: async (config) => {
      const error = new Error(`HTTP ${status}`)
      error.config = config
      error.response = {
        config,
        data: {},
        headers: {},
        status,
        statusText: 'Error',
      }

      throw error
    },
  })
}

function seedAuthenticatedStore() {
  const authStore = useAuthStore()
  const persistedSession = {
    token: 'access-token',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    user: { id: 1, username: 'reviewer', role: 'user' },
  }

  authStore.$patch({
    token: persistedSession.token,
    expiresAt: persistedSession.expires_at,
    user: persistedSession.user,
  })
  authSessionStorage.save(persistedSession)

  return authStore
}

describe('HTTP auth interceptors', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('добавляет Authorization header при наличии token', async () => {
    const client = createSuccessfulClient()
    const dispose = installAuthInterceptors(client, {
      getToken: () => 'access-token',
      onUnauthorized: vi.fn(),
    })

    const response = await client.get('/protected-resource')

    expect(response.config.headers.get('Authorization')).toBe('Bearer access-token')
    dispose()
  })

  it('не добавляет Authorization header без token', async () => {
    const client = createSuccessfulClient()
    const dispose = installAuthInterceptors(client, {
      getToken: () => null,
      onUnauthorized: vi.fn(),
    })

    const response = await client.get('/public-resource')

    expect(response.config.headers.get('Authorization')).toBeUndefined()
    dispose()
  })

  it('очищает state и persistence после 401', async () => {
    const authStore = seedAuthenticatedStore()
    const client = createErrorClient(401)
    const dispose = installAuthInterceptors(client, {
      getToken: () => authStore.token,
      onUnauthorized: () => authStore.logout(),
    })

    await expect(client.get('/protected-resource')).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    dispose()
  })

  it('не выполняет logout после 403', async () => {
    const authStore = seedAuthenticatedStore()
    const client = createErrorClient(403)
    const onUnauthorized = vi.fn(() => authStore.logout())
    const dispose = installAuthInterceptors(client, {
      getToken: () => authStore.token,
      onUnauthorized,
    })

    await expect(client.get('/forbidden-resource')).rejects.toMatchObject({
      response: { status: 403 },
    })
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(authStore.isAuthenticated).toBe(true)
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()
    dispose()
  })
})
