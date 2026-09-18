import { afterEach, describe, expect, it, vi } from 'vitest'

import { createBook, deleteBook, patchBook, replaceBook } from '../src/api/books.api'
import httpClient from '../src/api/http'

function createBookData(overrides = {}) {
  return {
    title: 'Vue на практике',
    year: 2025,
    description: 'Описание',
    isbn: '978-1-2345-6789-0',
    author_ids: [3, 7],
    cover: new File(['cover'], 'cover.png', { type: 'image/png' }),
    ...overrides,
  }
}

function createBookEnvelope() {
  return {
    data: {
      success: true,
      data: { id: 10, title: 'Vue на практике' },
    },
  }
}

describe('book mutation API adapters', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('создаёт книгу через FormData с cover и повторяющимся author_ids[]', async () => {
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue(createBookEnvelope())
    const data = createBookData()

    await createBook(data)

    const formData = postSpy.mock.calls[0][1]
    expect(formData).toBeInstanceOf(FormData)
    expect(formData.get('title')).toBe('Vue на практике')
    expect(formData.get('year')).toBe('2025')
    expect(formData.getAll('author_ids[]')).toEqual(['3', '7'])
    expect(formData.get('cover')).toBe(data.cover)
    expect(postSpy).toHaveBeenCalledWith('/books', formData)
  })

  it('обновляет без новой обложки через PATCH с точным JSON payload', async () => {
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValue(createBookEnvelope())

    await patchBook(10, {
      ...createBookData({ cover: null }),
      id: 10,
      authors: [{ id: 3, full_name: 'Анна' }],
      cover_url: '/covers/old.png',
    })

    expect(patchSpy).toHaveBeenCalledWith('/books/10', {
      title: 'Vue на практике',
      year: 2025,
      description: 'Описание',
      isbn: '978-1-2345-6789-0',
      author_ids: [3, 7],
    })
  })

  it('обновляет с новой обложкой через PUT FormData', async () => {
    const putSpy = vi.spyOn(httpClient, 'put').mockResolvedValue(createBookEnvelope())
    const data = createBookData({
      cover: new File(['new-cover'], 'new-cover.webp', { type: 'image/webp' }),
    })

    await replaceBook(10, data)

    const formData = putSpy.mock.calls[0][1]
    expect(formData).toBeInstanceOf(FormData)
    expect(formData.getAll('author_ids[]')).toEqual(['3', '7'])
    expect(formData.get('cover')).toBe(data.cover)
    expect(putSpy).toHaveBeenCalledWith('/books/10', formData)
  })

  it('удаляет книгу через документированный endpoint', async () => {
    const deleteSpy = vi.spyOn(httpClient, 'delete').mockResolvedValue({ status: 204 })

    await deleteBook(10)

    expect(deleteSpy).toHaveBeenCalledWith('/books/10')
  })
})
