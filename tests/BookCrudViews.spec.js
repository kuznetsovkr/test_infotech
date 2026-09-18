import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/books.api', () => ({
  createBook: vi.fn(),
  deleteBook: vi.fn(),
  getBook: vi.fn(),
  getBooks: vi.fn(),
  patchBook: vi.fn(),
  replaceBook: vi.fn(),
}))

vi.mock('../src/api/authors.api', () => ({
  createAuthor: vi.fn(),
  deleteAuthor: vi.fn(),
  getAuthor: vi.fn(),
  getAuthors: vi.fn(),
  updateAuthor: vi.fn(),
}))

import { getAuthors } from '../src/api/authors.api'
import {
  createBook,
  deleteBook,
  getBook,
  getBooks,
  patchBook,
  replaceBook,
} from '../src/api/books.api'
import BookForm from '../src/components/books/BookForm.vue'
import { createAppRouter } from '../src/router'
import { useAuthStore } from '../src/stores/auth'
import BookCreateView from '../src/views/BookCreateView.vue'
import BookDetailsView from '../src/views/BookDetailsView.vue'
import BookEditView from '../src/views/BookEditView.vue'
import BooksListView from '../src/views/BooksListView.vue'

const sampleBook = {
  id: 10,
  title: 'Vue на практике',
  year: 2025,
  description: 'Описание книги',
  isbn: '978-1-2345-6789-0',
  cover_url: '/covers/vue.png',
  authors: [
    { id: 3, full_name: 'Анна Авторова' },
    { id: 7, full_name: 'Иван Иванов' },
  ],
}

function authenticate(pinia) {
  const authStore = useAuthStore(pinia)
  authStore.$patch({
    token: 'access-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: { id: 1, username: 'reviewer' },
  })
  return authStore
}

function validPayload(overrides = {}) {
  return {
    title: 'Vue на практике',
    year: 2025,
    description: 'Описание книги',
    isbn: '978-1-2345-6789-0',
    author_ids: [3, 7],
    cover: new File(['cover'], 'cover.png', { type: 'image/png' }),
    ...overrides,
  }
}

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function setFile(wrapper, file) {
  const input = wrapper.get('#book-cover')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [file],
  })
  await input.trigger('change')
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

describe('book CRUD views', () => {
  const mountedWrappers = []

  beforeEach(() => {
    localStorage.clear()
    getBooks.mockResolvedValue({
      items: [sampleBook],
      pagination: { page: 1, totalPages: 1 },
    })
    getBook.mockResolvedValue(sampleBook)
    getAuthors.mockResolvedValue({
      items: sampleBook.authors,
      pagination: { page: 1, totalPages: 1 },
    })
    createBook.mockResolvedValue(sampleBook)
    patchBook.mockResolvedValue(sampleBook)
    replaceBook.mockResolvedValue(sampleBook)
    deleteBook.mockResolvedValue(undefined)
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
    const guest = await trackedMount(BooksListView, '/books?page=1')
    expect(guest.wrapper.text()).not.toContain('Добавить книгу')

    guest.wrapper.unmount()
    const authenticated = await trackedMount(BooksListView, '/books?page=1', {
      authenticated: true,
    })
    expect(authenticated.wrapper.get('a[href="/books/new"]').text()).toBe('Добавить книгу')
  })

  it('создаёт книгу один раз и переходит на detail', async () => {
    const request = createDeferred()
    createBook.mockReturnValue(request.promise)
    const { router, wrapper } = await trackedMount(BookCreateView, '/books/new', {
      authenticated: true,
    })
    const form = wrapper.getComponent(BookForm)
    const payload = validPayload()

    form.vm.$emit('submit', payload)
    form.vm.$emit('submit', payload)
    expect(createBook).toHaveBeenCalledTimes(1)
    expect(createBook).toHaveBeenCalledWith(payload)

    request.resolve(sampleBook)
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/books/10')
  })

  it('показывает backend field 422 возле control', async () => {
    createBook.mockRejectedValue({
      response: {
        status: 422,
        data: { errors: [{ field: 'title', message: 'Название уже используется.' }] },
      },
    })
    const { wrapper } = await trackedMount(BookCreateView, '/books/new', {
      authenticated: true,
    })

    wrapper.getComponent(BookForm).vm.$emit('submit', validPayload())
    await flushPromises()

    expect(wrapper.get('#book-title-error').text()).toBe('Название уже используется.')
  })

  it('показывает неизвестную backend ошибку на уровне формы', async () => {
    createBook.mockRejectedValue({
      response: {
        status: 422,
        data: { errors: [{ field: 'unknown', message: 'Данные не прошли проверку.' }] },
      },
    })
    const { wrapper } = await trackedMount(BookCreateView, '/books/new', {
      authenticated: true,
    })

    wrapper.getComponent(BookForm).vm.$emit('submit', validPayload())
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Данные не прошли проверку.')
  })

  it('загружает edit form, авторов и существующую обложку', async () => {
    const { wrapper } = await trackedMount(BookEditView, '/books/10/edit', {
      authenticated: true,
    })

    expect(getBook).toHaveBeenCalledWith(10, expect.objectContaining({ signal: expect.anything() }))
    expect(wrapper.get('#book-title').element.value).toBe('Vue на практике')
    expect(wrapper.get('#book-release-year').element.value).toBe('2025')
    expect(wrapper.findAll('.badge')).toHaveLength(2)
    expect(wrapper.get('img').attributes('src')).toBe('/covers/vue.png')
  })

  it('показывает not-found state при edit 404', async () => {
    getBook.mockRejectedValue({ response: { status: 404 } })
    const { wrapper } = await trackedMount(BookEditView, '/books/999/edit', {
      authenticated: true,
    })

    expect(wrapper.get('h1').text()).toBe('Книга не найдена')
  })

  it('использует PATCH без новой cover и возвращается на detail', async () => {
    const { router, wrapper } = await trackedMount(BookEditView, '/books/10/edit', {
      authenticated: true,
    })

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(patchBook).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        title: 'Vue на практике',
        year: 2025,
        author_ids: [3, 7],
        cover: null,
      }),
    )
    expect(replaceBook).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/books/10')
  })

  it('использует PUT при выборе новой cover', async () => {
    const { router, wrapper } = await trackedMount(BookEditView, '/books/10/edit', {
      authenticated: true,
    })
    const newCover = new File(['new'], 'new.png', { type: 'image/png' })

    await setFile(wrapper, newCover)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(replaceBook).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ cover: newCover, author_ids: [3, 7] }),
    )
    expect(patchBook).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/books/10')
  })

  it('скрывает edit/delete от гостя и показывает authenticated user', async () => {
    const guest = await trackedMount(BookDetailsView, '/books/10')
    expect(guest.wrapper.text()).not.toContain('Редактировать')
    expect(guest.wrapper.text()).not.toContain('Удалить')

    guest.wrapper.unmount()
    const authenticated = await trackedMount(BookDetailsView, '/books/10', {
      authenticated: true,
    })
    expect(authenticated.wrapper.get('a[href="/books/10/edit"]').text()).toBe('Редактировать')
    expect(authenticated.wrapper.get('button.btn-outline-danger').text()).toBe('Удалить')
  })

  it('вызывает DELETE только после подтверждения и переходит в каталог', async () => {
    const { router, wrapper } = await trackedMount(BookDetailsView, '/books/10', {
      authenticated: true,
      stubTeleport: true,
    })

    await wrapper.get('button.btn-outline-danger').trigger('click')
    expect(deleteBook).not.toHaveBeenCalled()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Удалить книгу?')

    await wrapper.get('button.btn-danger').trigger('click')
    await flushPromises()

    expect(deleteBook).toHaveBeenCalledTimes(1)
    expect(deleteBook).toHaveBeenCalledWith(10)
    expect(router.currentRoute.value.fullPath).toBe('/books')
  })

  it('показывает DELETE 403 и сохраняет auth session', async () => {
    deleteBook.mockRejectedValue({ response: { status: 403 } })
    const { authStore, wrapper } = await trackedMount(BookDetailsView, '/books/10', {
      authenticated: true,
      stubTeleport: true,
    })

    await wrapper.get('button.btn-outline-danger').trigger('click')
    await wrapper.get('button.btn-danger').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Недостаточно прав')
    expect(authStore.isAuthenticated).toBe(true)
  })

  it('показывает not-found state при DELETE 404', async () => {
    deleteBook.mockRejectedValue({ response: { status: 404 } })
    const { wrapper } = await trackedMount(BookDetailsView, '/books/10', {
      authenticated: true,
      stubTeleport: true,
    })

    await wrapper.get('button.btn-outline-danger').trigger('click')
    await wrapper.get('button.btn-danger').trigger('click')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Книга не найдена')
  })
})
