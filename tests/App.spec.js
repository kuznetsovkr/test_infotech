import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/books.api', () => ({
  createBook: vi.fn(),
  deleteBook: vi.fn(),
  getBook: vi.fn(),
  getBooks: vi.fn(),
  patchBook: vi.fn(),
  replaceBook: vi.fn(),
}))

import App from '../src/App.vue'
import { getBooks } from '../src/api/books.api'
import { createAppRouter } from '../src/router'

describe('App', () => {
  it('монтирует приложение и перенаправляет корневой route в каталог', async () => {
    getBooks.mockResolvedValue({
      items: [],
      pagination: { page: 1, totalPages: 0 },
    })
    const router = createAppRouter(createMemoryHistory())

    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
      },
    })
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('books')
    expect(wrapper.get('h1').text()).toBe('Каталог книг')
    expect(wrapper.get('a[href="/reports/top-authors"]').text()).toBe('ТОП авторов')

    wrapper.unmount()
  })
})
