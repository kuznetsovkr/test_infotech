import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/books.api', () => ({
  getBook: vi.fn(),
  getBooks: vi.fn(),
}))

import { getBook } from '../src/api/books.api'
import { createAppRouter } from '../src/router'
import BookDetailsView from '../src/views/BookDetailsView.vue'

describe('BookDetailsView', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.clearAllMocks()
  })

  async function mountView(path = '/books/10') {
    const router = createAppRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()
    wrapper = mount(BookDetailsView, { global: { plugins: [router] } })
    await flushPromises()
  }

  it('отображает данные книги и ссылки на авторов', async () => {
    getBook.mockResolvedValue({
      id: 10,
      title: 'Vue на практике',
      year: 2025,
      description: 'Подробное описание.',
      isbn: '978-1-2345-6789-0',
      cover_url: '',
      authors: [{ id: 3, full_name: 'Анна Авторова' }],
    })

    await mountView()

    expect(wrapper.get('h1').text()).toBe('Vue на практике')
    expect(wrapper.text()).toContain('Подробное описание.')
    expect(wrapper.text()).toContain('978-1-2345-6789-0')
    expect(wrapper.get('a[href="/authors/3"]').text()).toBe('Анна Авторова')
  })

  it('отображает отдельное состояние 404', async () => {
    getBook.mockRejectedValue({ response: { status: 404 } })

    await mountView()

    expect(wrapper.get('h1').text()).toBe('Книга не найдена')
    expect(wrapper.get('a[href="/books"]').exists()).toBe(true)
  })
})
