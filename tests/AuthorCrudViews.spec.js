import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/authors.api', () => ({
  createAuthor: vi.fn(),
  deleteAuthor: vi.fn(),
  getAuthor: vi.fn(),
  getAuthors: vi.fn(),
  updateAuthor: vi.fn(),
}))

import {
  createAuthor,
  deleteAuthor,
  getAuthor,
  getAuthors,
  updateAuthor,
} from '../src/api/authors.api'
import { createAppRouter } from '../src/router'
import { useAuthStore } from '../src/stores/auth'
import AuthorCreateView from '../src/views/AuthorCreateView.vue'
import AuthorDetailsView from '../src/views/AuthorDetailsView.vue'
import AuthorEditView from '../src/views/AuthorEditView.vue'
import AuthorsListView from '../src/views/AuthorsListView.vue'

function authenticate(pinia) {
  const authStore = useAuthStore(pinia)
  authStore.$patch({
    token: 'access-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: { id: 1, username: 'reviewer' },
  })

  return authStore
}

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

async function mountView(component, path, { authenticated = false, stubTeleport = false } = {}) {
  const pinia = createPinia()
  const authStore = authenticated ? authenticate(pinia) : useAuthStore(pinia)
  const router = createAppRouter(createMemoryHistory())

  await router.push(path)
  await router.isReady()

  const wrapper = mount(component, {
    global: {
      plugins: [pinia, router],
      stubs: stubTeleport ? { Teleport: true } : {},
    },
  })
  await flushPromises()

  return { authStore, router, wrapper }
}

describe('author CRUD views', () => {
  const mountedWrappers = []

  beforeEach(() => {
    localStorage.clear()
    getAuthors.mockResolvedValue({
      items: [{ id: 7, full_name: 'Анна Авторова' }],
      pagination: { page: 1, totalPages: 1 },
    })
    getAuthor.mockResolvedValue({ id: 7, full_name: 'Анна Авторова', books: [] })
    createAuthor.mockResolvedValue({ id: 7, full_name: 'Анна Авторова' })
    updateAuthor.mockResolvedValue({ id: 7, full_name: 'Анна Новая' })
    deleteAuthor.mockResolvedValue(undefined)
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.clearAllMocks()
  })

  async function trackedMount(...args) {
    const result = await mountView(...args)
    mountedWrappers.push(result.wrapper)
    return result
  }

  it('показывает create action только авторизованному пользователю', async () => {
    const guest = await trackedMount(AuthorsListView, '/authors?page=1')

    expect(guest.wrapper.text()).not.toContain('Добавить автора')
    expect(guest.wrapper.text()).not.toContain('Редактировать')

    guest.wrapper.unmount()
    const authenticated = await trackedMount(AuthorsListView, '/authors?page=1', {
      authenticated: true,
    })

    expect(authenticated.wrapper.get('a[href="/authors/new"]').text()).toBe('Добавить автора')
    expect(authenticated.wrapper.get('a[href="/authors/7/edit"]').text()).toBe('Редактировать')
  })

  it('отправляет trimmed full_name при создании и переходит на detail', async () => {
    const { router, wrapper } = await trackedMount(AuthorCreateView, '/authors/new', {
      authenticated: true,
    })

    await wrapper.get('#author-full-name').setValue('  Анна Авторова  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createAuthor).toHaveBeenCalledTimes(1)
    expect(createAuthor).toHaveBeenCalledWith({ full_name: 'Анна Авторова' })
    expect(router.currentRoute.value.fullPath).toBe('/authors/7')
  })

  it('не отправляет имя, состоящее только из пробелов', async () => {
    const { wrapper } = await trackedMount(AuthorCreateView, '/authors/new', {
      authenticated: true,
    })

    await wrapper.get('#author-full-name').setValue('   ')
    await wrapper.get('form').trigger('submit')

    expect(createAuthor).not.toHaveBeenCalled()
    expect(wrapper.get('#author-full-name-error').text()).toBe('Укажите ФИО автора.')
    expect(wrapper.get('#author-full-name').attributes('aria-invalid')).toBe('true')
  })

  it('не отправляет create повторно во время активного запроса', async () => {
    const request = createDeferred()
    createAuthor.mockReturnValue(request.promise)
    const { wrapper } = await trackedMount(AuthorCreateView, '/authors/new', {
      authenticated: true,
    })

    await wrapper.get('#author-full-name').setValue('Анна Авторова')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(createAuthor).toHaveBeenCalledTimes(1)

    request.resolve({ id: 7, full_name: 'Анна Авторова' })
    await flushPromises()
  })

  it('показывает backend 422 для full_name возле поля', async () => {
    createAuthor.mockRejectedValue({
      response: {
        status: 422,
        data: { errors: [{ field: 'full_name', message: 'Автор с таким именем уже существует.' }] },
      },
    })
    const { wrapper } = await trackedMount(AuthorCreateView, '/authors/new', {
      authenticated: true,
    })

    await wrapper.get('#author-full-name').setValue('Анна Авторова')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('#author-full-name-error').text()).toBe(
      'Автор с таким именем уже существует.',
    )
  })

  it('показывает general 422 как form-level error', async () => {
    createAuthor.mockRejectedValue({
      response: {
        status: 422,
        data: { errors: [{ field: '', message: 'Данные не прошли проверку.' }] },
      },
    })
    const { wrapper } = await trackedMount(AuthorCreateView, '/authors/new', {
      authenticated: true,
    })

    await wrapper.get('#author-full-name').setValue('Анна Авторова')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Данные не прошли проверку.')
  })

  it('загружает автора, обновляет только full_name и возвращает на detail', async () => {
    const { router, wrapper } = await trackedMount(AuthorEditView, '/authors/7/edit', {
      authenticated: true,
    })

    expect(getAuthor).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ signal: expect.anything() }),
    )
    expect(wrapper.get('#author-full-name').element.value).toBe('Анна Авторова')

    await wrapper.get('#author-full-name').setValue('  Анна Новая  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateAuthor).toHaveBeenCalledWith(7, { full_name: 'Анна Новая' })
    expect(router.currentRoute.value.fullPath).toBe('/authors/7')
  })

  it('скрывает edit/delete controls от гостя и сохраняет публичную страницу', async () => {
    const { wrapper } = await trackedMount(AuthorDetailsView, '/authors/7')

    expect(wrapper.get('h1').text()).toBe('Анна Авторова')
    expect(wrapper.text()).not.toContain('Редактировать')
    expect(wrapper.text()).not.toContain('Удалить')
  })

  it('вызывает DELETE только после подтверждения и переходит к списку', async () => {
    const { router, wrapper } = await trackedMount(AuthorDetailsView, '/authors/7', {
      authenticated: true,
      stubTeleport: true,
    })

    await wrapper.get('button.btn-outline-danger').trigger('click')
    expect(deleteAuthor).not.toHaveBeenCalled()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Удалить автора?')

    await wrapper.get('button.btn-danger').trigger('click')
    await flushPromises()

    expect(deleteAuthor).toHaveBeenCalledTimes(1)
    expect(deleteAuthor).toHaveBeenCalledWith(7)
    expect(router.currentRoute.value.fullPath).toBe('/authors')
  })

  it('показывает DELETE 403 и не завершает auth session', async () => {
    deleteAuthor.mockRejectedValue({ response: { status: 403 } })
    const { authStore, wrapper } = await trackedMount(AuthorDetailsView, '/authors/7', {
      authenticated: true,
      stubTeleport: true,
    })

    await wrapper.get('button.btn-outline-danger').trigger('click')
    await wrapper.get('button.btn-danger').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Недостаточно прав')
    expect(authStore.isAuthenticated).toBe(true)
  })
})
