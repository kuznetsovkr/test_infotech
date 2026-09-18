import httpClient from './http'
import { normalizeEntityResponse, normalizeListResponse } from './response'

const DEFAULT_BOOKS_PER_PAGE = 12

export async function getBooks({
  page = 1,
  perPage = DEFAULT_BOOKS_PER_PAGE,
  authorId,
  year,
  search,
  signal,
} = {}) {
  const params = {
    page,
    'per-page': perPage,
  }

  if (Number.isInteger(authorId)) {
    params.author_id = authorId
  }

  if (Number.isInteger(year)) {
    params.year = year
  }

  const normalizedSearch = typeof search === 'string' ? search.trim() : ''

  if (normalizedSearch) {
    params.search = normalizedSearch
  }

  const config = { params }

  if (signal) {
    config.signal = signal
  }

  const response = await httpClient.get('/books', config)

  return normalizeListResponse(response, { page, perPage })
}

export async function getBook(id, { signal } = {}) {
  const config = signal ? { signal } : undefined
  const response = await httpClient.get(`/books/${id}`, config)

  return normalizeEntityResponse(response)
}
