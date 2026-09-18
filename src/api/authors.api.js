import httpClient from './http'
import { normalizeEntityResponse, normalizeListResponse } from './response'

const DEFAULT_AUTHORS_PER_PAGE = 20

export async function getAuthors({
  page = 1,
  perPage = DEFAULT_AUTHORS_PER_PAGE,
  search,
  signal,
} = {}) {
  const params = {
    page,
    'per-page': perPage,
  }
  const normalizedSearch = typeof search === 'string' ? search.trim() : ''

  if (normalizedSearch) {
    params.search = normalizedSearch
  }

  const config = { params }

  if (signal) {
    config.signal = signal
  }

  const response = await httpClient.get('/authors', config)

  return normalizeListResponse(response, { page, perPage })
}

export async function getAuthor(id, { signal } = {}) {
  const config = signal ? { signal } : undefined
  const response = await httpClient.get(`/authors/${id}`, config)

  return normalizeEntityResponse(response)
}

export async function createAuthor({ full_name }) {
  const response = await httpClient.post('/authors', { full_name })

  return normalizeEntityResponse(response)
}

export async function updateAuthor(id, { full_name }) {
  const response = await httpClient.put(`/authors/${id}`, { full_name })

  return normalizeEntityResponse(response)
}

export async function deleteAuthor(id) {
  await httpClient.delete(`/authors/${id}`)
}
