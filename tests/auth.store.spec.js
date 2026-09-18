import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/auth.api', () => ({
  login: vi.fn(),
}))

import { login as loginRequest } from '../src/api/auth.api'
import { useAuthStore } from '../src/stores/auth'
import { AUTH_STORAGE_KEY } from '../src/stores/authStorage'

function createSession(overrides = {}) {
  return {
    token: 'access-token',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: 1,
      username: 'reviewer',
      role: 'user',
    },
    ...overrides,
  }
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('выполняет login, обновляет state и сохраняет только данные API session', async () => {
    const authStore = useAuthStore()
    const session = createSession()
    const credentials = {
      username: 'reviewer',
      password: 'super-secret-password',
    }

    loginRequest.mockResolvedValue({
      success: true,
      data: session,
    })

    await authStore.login(credentials)

    expect(loginRequest).toHaveBeenCalledWith(credentials)
    expect(authStore.token).toBe(session.token)
    expect(authStore.expiresAt).toBe(session.expires_at)
    expect(authStore.user).toEqual(session.user)
    expect(authStore.isAuthenticated).toBe(true)

    const persistedSession = localStorage.getItem(AUTH_STORAGE_KEY)
    expect(JSON.parse(persistedSession)).toEqual(session)
    expect(persistedSession).not.toContain(credentials.password)
  })

  it('восстанавливает валидную persisted session', () => {
    const session = createSession()
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))

    const authStore = useAuthStore()

    expect(authStore.restoreSession()).toBe(true)
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.token).toBe(session.token)
    expect(authStore.expiresAt).toBe(session.expires_at)
    expect(authStore.user).toEqual(session.user)
  })

  it('очищает истёкшую persisted session', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify(createSession({ expires_at: new Date(Date.now() - 1_000).toISOString() })),
    )

    const authStore = useAuthStore()

    expect(authStore.restoreSession()).toBe(false)
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.token).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it.each([
    ['invalid JSON', '{not-json'],
    ['session without expires_at', JSON.stringify({ token: 'token', user: { id: 1 } })],
    [
      'session with invalid expires_at',
      JSON.stringify(createSession({ expires_at: 'not-a-date' })),
    ],
  ])('безопасно очищает malformed persisted session: %s', (_caseName, storedValue) => {
    localStorage.setItem(AUTH_STORAGE_KEY, storedValue)

    const authStore = useAuthStore()

    expect(() => authStore.restoreSession()).not.toThrow()
    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })
})
