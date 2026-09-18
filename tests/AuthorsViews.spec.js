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

import { getAuthor, getAuthors } from '../src/api/authors.api'
import { createAppRouter } from '../src/router'
import AuthorDetailsView from '../src/views/AuthorDetailsView.vue'
import AuthorsListView from '../src/views/AuthorsListView.vue'

describe('public authors views', () => {
  let wrapper

  beforeEach(() => {
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

  it('отображает список авторов и синхронизирует search/pagination с URL', async () => {
    getAuthors.mockResolvedValue({
      items: [{ id: 3, full_name: 'Анна Авторова' }],
      pagination: { page: 2, totalPages: 3 },
    })
    const router = createAppRouter(createMemoryHistory())
    await router.push('/authors?search=Анна&page=2')
    await router.isReady()
    wrapper = mount(AuthorsListView, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(wrapper.get('[data-testid="authors-list"]').text()).toContain('Анна Авторова')
    expect(wrapper.get('a[href="/authors/3"]').exists()).toBe(true)
    expect(getAuthors).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, perPage: 20, search: 'Анна' }),
    )

    await wrapper.get('button[aria-label="Следующая страница"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.page).toBe('3')

    await wrapper.get('#author-search').setValue('Борис')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ search: 'Борис', page: '1' })
  })

  it('показывает книги автора как BookShort со ссылками на book route', async () => {
    getAuthor.mockResolvedValue({
      id: 3,
      full_name: 'Анна Авторова',
      books: [{ id: 10, title: 'Vue на практике', year: 2025 }],
    })
    const router = createAppRouter(createMemoryHistory())
    await router.push('/authors/3')
    await router.isReady()
    wrapper = mount(AuthorDetailsView, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Анна Авторова')
    expect(wrapper.get('[data-testid="author-books"]').text()).toContain('2025')
    expect(wrapper.get('a[href="/books/10"]').text()).toBe('Vue на практике')
  })

  it('отображает 404 для отсутствующего автора', async () => {
    getAuthor.mockRejectedValue({ response: { status: 404 } })
    const router = createAppRouter(createMemoryHistory())
    await router.push('/authors/999')
    await router.isReady()
    wrapper = mount(AuthorDetailsView, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Автор не найден')
  })
})
