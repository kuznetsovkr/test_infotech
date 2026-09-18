import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAuthor, getAuthors } from '../src/api/authors.api'
import { getBook, getBooks } from '../src/api/books.api'
import httpClient from '../src/api/http'

function createListEnvelope() {
  return {
    data: {
      success: true,
      data: {
        items: [],
        pagination: {
          total: 0,
          page: 2,
          per_page: 12,
          total_pages: 0,
        },
      },
    },
  }
}

describe('public API adapters', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('передаёт все book query parameters с точным ключом per-page', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(createListEnvelope())

    await getBooks({
      page: 2,
      perPage: 12,
      authorId: 3,
      year: 2025,
      search: '  vue  ',
    })

    expect(getSpy).toHaveBeenCalledWith('/books', {
      params: {
        page: 2,
        'per-page': 12,
        author_id: 3,
        year: 2025,
        search: 'vue',
      },
    })
  })

  it('передаёт author pagination/search и использует публичные detail endpoints', async () => {
    const getSpy = vi
      .spyOn(httpClient, 'get')
      .mockResolvedValueOnce(createListEnvelope())
      .mockResolvedValueOnce({ data: { success: true, data: { id: 7, full_name: 'Автор' } } })
      .mockResolvedValueOnce({ data: { success: true, data: { id: 11, title: 'Книга' } } })

    await getAuthors({ page: 2, perPage: 10, search: 'Автор' })
    await getAuthor(7)
    await getBook(11)

    expect(getSpy).toHaveBeenNthCalledWith(1, '/authors', {
      params: { page: 2, 'per-page': 10, search: 'Автор' },
    })
    expect(getSpy).toHaveBeenNthCalledWith(2, '/authors/7', undefined)
    expect(getSpy).toHaveBeenNthCalledWith(3, '/books/11', undefined)
  })
})
