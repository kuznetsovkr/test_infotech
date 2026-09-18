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

import { getAuthor, getAuthors } from '../src/api/authors.api'
import { getBooks } from '../src/api/books.api'
import { createAppRouter } from '../src/router'
import BooksListView from '../src/views/BooksListView.vue'

function createBooksResponse(items = [], overrides = {}) {
  return {
    items,
    pagination: {
      page: 1,
      total: items.length,
      perPage: 12,
      totalPages: items.length ? 1 : 0,
      ...overrides,
    },
  }
}

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

describe('BooksListView', () => {
  let wrapper

  beforeEach(() => {
    getBooks.mockResolvedValue(createBooksResponse())
    getAuthor.mockResolvedValue({ id: 3, full_name: 'Тестовый автор', books: [] })
    getAuthors.mockResolvedValue({
      items: [],
      pagination: { page: 1, totalPages: 0 },
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.clearAllMocks()
  })

  async function mountView(path = '/books?page=1') {
    const router = createAppRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()

    wrapper = mount(BooksListView, {
      global: {
        plugins: [createPinia(), router],
      },
    })
    await flushPromises()

    return router
  }

  it('отображает книги, ISBN и ссылки на книгу и автора', async () => {
    getBooks.mockResolvedValue(
      createBooksResponse([
        {
          id: 10,
          title: 'Vue на практике',
          year: 2025,
          isbn: '978-1-2345-6789-0',
          cover_url: '',
          authors: [{ id: 3, full_name: 'Анна Авторова' }],
        },
      ]),
    )

    await mountView()

    expect(wrapper.get('[data-testid="books-list"]').text()).toContain('Vue на практике')
    expect(wrapper.text()).toContain('ISBN: 978-1-2345-6789-0')
    expect(wrapper.text()).toContain('Нет обложки')
    expect(wrapper.get('a[href="/books/10"]').exists()).toBe(true)
    expect(wrapper.get('a[href="/authors/3"]').exists()).toBe(true)
  })

  it('показывает loading state', async () => {
    const deferred = createDeferred()
    getBooks.mockReturnValue(deferred.promise)
    const router = createAppRouter(createMemoryHistory())
    await router.push('/books?page=1')
    await router.isReady()

    wrapper = mount(BooksListView, { global: { plugins: [createPinia(), router] } })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="status"]').text()).toContain('Загрузка книг')

    deferred.resolve(createBooksResponse())
    await flushPromises()
  })

  it('показывает empty state', async () => {
    await mountView()

    expect(wrapper.text()).toContain('По заданным условиям книги не найдены.')
  })

  it('показывает error state', async () => {
    getBooks.mockRejectedValue(new Error('Network error'))

    await mountView()

    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось загрузить каталог книг')
  })

  it('синхронизирует filters с URL и сбрасывает page после submit', async () => {
    const router = await mountView('/books?search=vue&year=2025&author_id=3&page=2')

    expect(getBooks).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        perPage: 12,
        authorId: 3,
        year: 2025,
        search: 'vue',
      }),
    )
    expect(wrapper.get('#book-search').element.value).toBe('vue')
    expect(wrapper.get('#book-year').element.value).toBe('2025')

    await wrapper.get('#book-search').setValue('pinia')
    await wrapper.get('#book-year').setValue('2026')
    await wrapper.get('[data-testid="book-filters"]').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.query).toMatchObject({
      search: 'pinia',
      year: '2026',
      author_id: '3',
      page: '1',
    })
  })

  it('изменяет page через pagination', async () => {
    getBooks.mockResolvedValue(createBooksResponse([{ id: 1, title: 'Книга' }], { totalPages: 3 }))
    const router = await mountView()

    await wrapper.get('button[aria-label="Следующая страница"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.page).toBe('2')
    expect(getBooks).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
  })

  it('безопасно нормализует некорректные query parameters', async () => {
    const router = await mountView('/books?page=-2&year=abc&author_id=unknown')

    expect(router.currentRoute.value.query.page).toBe('1')
    expect(router.currentRoute.value.query.year).toBeUndefined()
    expect(router.currentRoute.value.query.author_id).toBeUndefined()
    expect(getBooks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, year: null, authorId: null }),
    )
  })

  it('выбирает автора через серверный searchable selector', async () => {
    getAuthors.mockResolvedValue({
      items: [{ id: 8, full_name: 'Иван Иванов' }],
      pagination: { page: 1, totalPages: 1 },
    })
    const router = await mountView()
    await wrapper.get('#author-filter-search').setValue('Иван')
    const authorSearchForm = wrapper
      .findAll('form')
      .find((form) => form.find('#author-filter-search').exists())

    await authorSearchForm.trigger('submit')
    await flushPromises()
    const authorButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Иван Иванов'))
    await authorButton.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.author_id).toBe('8')
    expect(router.currentRoute.value.query.page).toBe('1')
  })

  it('не позволяет устаревшему response перезаписать новый', async () => {
    const firstRequest = createDeferred()
    getBooks
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce(createBooksResponse([{ id: 2, title: 'Новый результат' }]))

    const router = createAppRouter(createMemoryHistory())
    await router.push('/books?page=1')
    await router.isReady()
    wrapper = mount(BooksListView, { global: { plugins: [createPinia(), router] } })
    await wrapper.vm.$nextTick()

    await router.push('/books?search=new&page=1')
    await flushPromises()
    firstRequest.resolve(createBooksResponse([{ id: 1, title: 'Устаревший результат' }]))
    await flushPromises()

    expect(wrapper.text()).toContain('Новый результат')
    expect(wrapper.text()).not.toContain('Устаревший результат')
  })
})
