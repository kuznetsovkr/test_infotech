import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/authors.api', () => ({
  getAuthors: vi.fn(),
}))

import { getAuthors } from '../src/api/authors.api'
import BookForm from '../src/components/books/BookForm.vue'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/books', name: 'books', component: { template: '<div />' } },
      { path: '/books/:id', name: 'book-details', component: { template: '<div />' } },
    ],
  })
}

async function setFile(wrapper, file) {
  const input = wrapper.get('#book-cover')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: file ? [file] : [],
  })
  await input.trigger('change')
}

describe('BookForm', () => {
  const mountedWrappers = []
  let originalCreateObjectUrl
  let originalRevokeObjectUrl

  beforeEach(() => {
    getAuthors.mockResolvedValue({
      items: [],
      pagination: { page: 1, totalPages: 0 },
    })
    originalCreateObjectUrl = URL.createObjectURL
    originalRevokeObjectUrl = URL.revokeObjectURL
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    URL.createObjectURL = originalCreateObjectUrl
    URL.revokeObjectURL = originalRevokeObjectUrl
    vi.clearAllMocks()
  })

  async function mountForm(props = {}) {
    const router = createTestRouter()
    await router.push('/books')
    await router.isReady()
    const wrapper = mount(BookForm, {
      props: {
        cancelTo: { name: 'books' },
        submitLabel: 'Сохранить',
        ...props,
      },
      global: { plugins: [router] },
    })
    mountedWrappers.push(wrapper)
    return wrapper
  }

  it('блокирует whitespace title, нецелый year, пустых authors и отсутствующую cover', async () => {
    const wrapper = await mountForm({ requireCover: true })

    await wrapper.get('#book-title').setValue('   ')
    await wrapper.get('#book-release-year').setValue('2025.5')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('#book-title-error').text()).toBe('Укажите название книги.')
    expect(wrapper.get('#book-year-error').text()).toBe('Год должен быть целым числом.')
    expect(wrapper.get('#book-authors-error').text()).toBe('Выберите хотя бы одного автора.')
    expect(wrapper.get('#book-cover-error').text()).toBe('Выберите обложку.')
  })

  it('позволяет выбрать нескольких авторов, не добавляет duplicate и удаляет выбранного', async () => {
    getAuthors.mockResolvedValue({
      items: [
        { id: 3, full_name: 'Анна Авторова' },
        { id: 7, full_name: 'Иван Иванов' },
      ],
      pagination: { page: 1, totalPages: 1 },
    })
    const wrapper = await mountForm()

    const findButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Найти')
    await findButton.trigger('click')
    await flushPromises()

    const annaButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Анна Авторова'))
    await annaButton.trigger('click')
    const ivanButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Иван Иванов'))
    await ivanButton.trigger('click')

    expect(wrapper.findAll('.badge')).toHaveLength(2)
    expect(annaButton.attributes('disabled')).toBeDefined()

    await annaButton.trigger('click')
    expect(wrapper.findAll('.badge')).toHaveLength(2)

    await wrapper.get('button[aria-label="Удалить автора Анна Авторова"]').trigger('click')
    expect(wrapper.findAll('.badge')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Анна Авторова — добавлен')
  })

  it('эмитит нормализованный payload с integer year, author ids и cover', async () => {
    const wrapper = await mountForm({
      requireCover: true,
      initialBook: {
        title: 'Vue',
        year: 2025,
        description: ' Описание ',
        isbn: ' 978-1 ',
        authors: [{ id: 3, full_name: 'Анна Авторова' }],
      },
    })
    const cover = new File(['cover'], 'cover.png', { type: 'image/png' })

    await setFile(wrapper, cover)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')[0][0]).toEqual({
      title: 'Vue',
      year: 2025,
      description: 'Описание',
      isbn: '978-1',
      author_ids: [3],
      cover,
    })
  })

  it('отклоняет файл без image MIME', async () => {
    const wrapper = await mountForm()

    await setFile(wrapper, new File(['text'], 'notes.txt', { type: 'text/plain' }))

    expect(wrapper.get('#book-cover-error').text()).toBe('Выберите файл изображения.')
  })

  it('освобождает object URL при замене файла и unmount', async () => {
    URL.createObjectURL = vi
      .fn()
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')
    URL.revokeObjectURL = vi.fn()
    const wrapper = await mountForm({
      initialBook: { title: 'Vue', cover_url: '/covers/old.png' },
    })

    expect(wrapper.get('img').attributes('src')).toBe('/covers/old.png')

    await setFile(wrapper, new File(['first'], 'first.png', { type: 'image/png' }))
    expect(wrapper.get('img').attributes('src')).toBe('blob:first')

    await setFile(wrapper, new File(['second'], 'second.png', { type: 'image/png' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
    expect(wrapper.get('img').attributes('src')).toBe('blob:second')

    wrapper.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second')
  })
})
