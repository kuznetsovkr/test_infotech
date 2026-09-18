import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { createAppRouter, handleUnauthorized, registerAuthGuards } from '../src/router'
import { useAuthStore } from '../src/stores/auth'

function createGuardedRouter() {
  const pinia = createPinia()
  const router = createAppRouter(createMemoryHistory())
  registerAuthGuards(router, pinia)

  return { pinia, router }
}

function authenticate(authStore) {
  authStore.$patch({
    token: 'access-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: { id: 1, username: 'reviewer', role: 'user' },
  })
}

describe('auth route guards', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('перенаправляет guest с protected route на login с intended destination', async () => {
    const { router } = createGuardedRouter()

    await router.push('/account')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/account')
  })

  it('не позволяет guest открыть форму создания автора', async () => {
    const { router } = createGuardedRouter()

    await router.push('/authors/new')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/authors/new')
  })

  it('не позволяет guest открыть форму создания книги', async () => {
    const { router } = createGuardedRouter()

    await router.push('/books/new')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/books/new')
  })

  it('разрешает authenticated user открыть protected route', async () => {
    const { pinia, router } = createGuardedRouter()
    authenticate(useAuthStore(pinia))

    await router.push('/account')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('account')
  })

  it('возвращает authenticated user на безопасный internal redirect', async () => {
    const { pinia, router } = createGuardedRouter()
    authenticate(useAuthStore(pinia))

    await router.push('/login?redirect=/account')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('account')
  })

  it('не допускает open redirect на внешний URL', async () => {
    const { pinia, router } = createGuardedRouter()
    authenticate(useAuthStore(pinia))

    await router.push('/login?redirect=https://example.com')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('books')
  })

  it('после 401 переводит пользователя с protected route на login', async () => {
    const { pinia, router } = createGuardedRouter()
    const authStore = useAuthStore(pinia)
    authenticate(authStore)
    await router.push('/account')

    await handleUnauthorized(router, authStore)

    expect(authStore.isAuthenticated).toBe(false)
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/account')
  })

  it('не создаёт redirect loop при 401 непосредственно на login route', async () => {
    const { pinia, router } = createGuardedRouter()
    const authStore = useAuthStore(pinia)
    await router.push('/login')

    expect(handleUnauthorized(router, authStore)).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
    expect(authStore.isAuthenticated).toBe(false)
  })
})
