import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/auth.api', () => ({
  login: vi.fn(),
}))

import { login as loginRequest } from '../src/api/auth.api'
import { createAppRouter, registerAuthGuards } from '../src/router'
import { useAuthStore } from '../src/stores/auth'
import LoginView from '../src/views/LoginView.vue'

describe('LoginView', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('показывает понятную ошибку после 401 и оставляет форму доступной', async () => {
    loginRequest.mockRejectedValue({
      response: {
        status: 401,
        data: {
          success: false,
          errors: [{ field: 'password', message: 'Invalid credentials' }],
        },
      },
    })

    const pinia = createPinia()
    const router = createAppRouter(createMemoryHistory())
    registerAuthGuards(router, pinia)
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      attachTo: document.body,
      global: {
        plugins: [pinia, router],
      },
    })

    await wrapper.get('#username').setValue('reviewer')
    await wrapper.get('#password').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(loginRequest).toHaveBeenCalledWith({
      username: 'reviewer',
      password: 'wrong-password',
    })
    expect(wrapper.get('[role="alert"]').text()).toBe('Неверное имя пользователя или пароль.')
    expect(useAuthStore(pinia).isAuthenticated).toBe(false)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('#password').element.disabled).toBe(false)
    expect(wrapper.get('#password').element.value).toBe('wrong-password')

    wrapper.unmount()
  })

  it('блокирует повторный submit, пока login request выполняется', async () => {
    let resolveLogin
    loginRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve
        }),
    )

    const pinia = createPinia()
    const router = createAppRouter(createMemoryHistory())
    registerAuthGuards(router, pinia)
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [pinia, router],
      },
    })

    await wrapper.get('#username').setValue('reviewer')
    await wrapper.get('#password').setValue('valid-password')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(loginRequest).toHaveBeenCalledTimes(1)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()

    resolveLogin({
      success: true,
      data: {
        token: 'access-token',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        user: { id: 1, username: 'reviewer', role: 'user' },
      },
    })
    await flushPromises()

    expect(useAuthStore(pinia).isAuthenticated).toBe(true)
    expect(router.currentRoute.value.name).toBe('home')
    wrapper.unmount()
  })
})
