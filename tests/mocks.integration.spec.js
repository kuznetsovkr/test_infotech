// @vitest-environment node

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getMockDatabase, resetMockDatabase } from '../src/mocks/db'
import { handlers } from '../src/mocks/handlers'
import { DEMO_CREDENTIALS, DEMO_TOKEN, SEED_AUTHOR_COUNT, SEED_BOOK_COUNT } from '../src/mocks/seed'
import {
  appendDemoSmsLog,
  getDemoSmsLog,
  getDemoSubscriptions,
  subscribeToDemoAuthor,
} from '../src/mocks/subscriptions'

const API_URL = 'http://book-catalog.test/api/v1'
const authorizationHeaders = {
  Authorization: `Bearer ${DEMO_TOKEN}`,
}
const server = setupServer(...handlers)
const storageEntries = new Map()
const demoLocalStorage = {
  getItem(key) {
    return storageEntries.get(key) ?? null
  },
  setItem(key, value) {
    storageEntries.set(key, String(value))
  },
  removeItem(key) {
    storageEntries.delete(key)
  },
  clear() {
    storageEntries.clear()
  },
}

function createBookMultipart({
  title = 'Новая demo-книга',
  year = 2031,
  authorIds = [1, 2],
  coverContents = 'first-cover',
} = {}) {
  const boundary = '----infotech-demo-test-boundary'
  const parts = []
  const appendField = (name, value) => {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    )
  }

  appendField('title', title)
  appendField('year', year)
  appendField('description', 'Описание demo-книги')
  appendField('isbn', '978-5-123456-78-9')

  for (const authorId of authorIds) {
    appendField('author_ids[]', authorId)
  }

  if (coverContents !== null) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="cover"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n${coverContents}\r\n`,
    )
  }

  parts.push(`--${boundary}--\r\n`)

  return {
    body: parts.join(''),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

async function readJson(response) {
  return response.json()
}

async function createBook(options) {
  const multipart = createBookMultipart(options)

  return fetch(`${API_URL}/books`, {
    method: 'POST',
    headers: { ...authorizationHeaders, 'Content-Type': multipart.contentType },
    body: multipart.body,
  })
}

async function waitForSmsLog(predicate, timeout = 1000) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const entries = getDemoSmsLog()

    if (predicate(entries)) {
      return entries
    }

    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error('Timed out while waiting for the demo SMS log.')
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: demoLocalStorage,
  })
  server.listen({ onUnhandledRequest: 'error' })
})

beforeEach(() => {
  globalThis.localStorage.clear()
  resetMockDatabase()
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('MSW demo authentication and public reads', () => {
  it('returns a contract-compatible session for demo credentials', async () => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEMO_CREDENTIALS),
    })
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      data: {
        token: DEMO_TOKEN,
        user: { id: 1, username: 'demo', role: 'user' },
      },
    })
    expect(Date.parse(body.data.expires_at)).toBeGreaterThan(Date.now())
  })

  it('returns the Error schema for invalid credentials', async () => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: 'wrong' }),
    })
    const body = await readJson(response)

    expect(response.status).toBe(401)
    expect(body).toEqual({
      success: false,
      errors: [{ field: 'credentials', message: 'Неверное имя пользователя или пароль.' }],
    })
  })

  it('serves public books and applies filters before pagination', async () => {
    const response = await fetch(
      `${API_URL}/books?search=${encodeURIComponent('доступный')}&year=2025&author_id=3&page=2&per-page=1`,
    )
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.data.pagination).toEqual({
      total: 2,
      page: 2,
      per_page: 1,
      total_pages: 2,
    })
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0]).toMatchObject({ year: 2025 })
    expect(body.data.items[0].authors.map((author) => author.id)).toContain(3)
  })
})

describe('MSW demo book mutations', () => {
  it('protects mutations and returns a field-based 422 response', async () => {
    const validMultipart = createBookMultipart()
    const unauthorizedResponse = await fetch(`${API_URL}/books`, {
      method: 'POST',
      headers: { 'Content-Type': validMultipart.contentType },
      body: validMultipart.body,
    })
    const invalidMultipart = createBookMultipart({
      title: '   ',
      authorIds: [],
      coverContents: null,
    })
    const validationResponse = await fetch(`${API_URL}/books`, {
      method: 'POST',
      headers: { ...authorizationHeaders, 'Content-Type': invalidMultipart.contentType },
      body: invalidMultipart.body,
    })
    const validationBody = await readJson(validationResponse)

    expect(unauthorizedResponse.status).toBe(401)
    expect(validationResponse.status).toBe(422)
    expect(validationBody.success).toBe(false)
    expect(validationBody.errors.map((error) => error.field)).toEqual([
      'title',
      'author_ids',
      'cover',
    ])
  })

  it('supports create, GET, PATCH with the old cover, PUT with a new cover, and DELETE', async () => {
    const createResponse = await createBook()
    const createdBook = (await readJson(createResponse)).data

    expect(createResponse.status).toBe(201)
    expect(createdBook.authors.map((author) => author.id)).toEqual([1, 2])
    expect(createdBook.cover_url).toMatch(/^data:image\/png;base64,/)

    const getResponse = await fetch(`${API_URL}/books/${createdBook.id}`)
    const fetchedBook = (await readJson(getResponse)).data

    expect(fetchedBook.id).toBe(createdBook.id)

    const patchResponse = await fetch(`${API_URL}/books/${createdBook.id}`, {
      method: 'PATCH',
      headers: { ...authorizationHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Название после PATCH', year: 2032, author_ids: [2] }),
    })
    const patchedBook = (await readJson(patchResponse)).data

    expect(patchedBook).toMatchObject({ title: 'Название после PATCH', year: 2032 })
    expect(patchedBook.cover_url).toBe(createdBook.cover_url)

    const replacementMultipart = createBookMultipart({
      title: 'Название после PUT',
      year: 2033,
      authorIds: [3, 4],
      coverContents: 'replacement-cover',
    })
    const putResponse = await fetch(`${API_URL}/books/${createdBook.id}`, {
      method: 'PUT',
      headers: {
        ...authorizationHeaders,
        'Content-Type': replacementMultipart.contentType,
      },
      body: replacementMultipart.body,
    })
    const replacedBook = (await readJson(putResponse)).data

    expect(replacedBook.cover_url).not.toBe(createdBook.cover_url)
    expect(replacedBook.authors.map((author) => author.id)).toEqual([3, 4])

    const deleteResponse = await fetch(`${API_URL}/books/${createdBook.id}`, {
      method: 'DELETE',
      headers: authorizationHeaders,
    })
    const deletedBookResponse = await fetch(`${API_URL}/books/${createdBook.id}`)

    expect(deleteResponse.status).toBe(204)
    expect(deletedBookResponse.status).toBe(404)
  })
})

describe('MSW demo notification side effect', () => {
  it('initiates the bridge after book creation for a subscribed author', async () => {
    subscribeToDemoAuthor({ authorId: 1, phone: '+7 999 123-45-67' })
    const bridgeRequests = []
    server.use(
      http.post('http://book-catalog.test/__demo/sms/send', async ({ request }) => {
        bridgeRequests.push(await request.json())

        return HttpResponse.json({
          success: true,
          provider: 'smspilot',
          emulated: true,
          server_id: '1000',
        })
      }),
    )

    const response = await createBook({
      title: 'Книга с подпиской',
      authorIds: [1],
    })
    const createdBook = (await readJson(response)).data
    const entries = await waitForSmsLog((items) => items.length === 1)

    expect(response.status).toBe(201)
    expect(bridgeRequests).toEqual([
      {
        phone: '79991234567',
        message: expect.stringContaining('Книга с подпиской'),
      },
    ])
    expect(entries[0]).toMatchObject({
      book_id: createdBook.id,
      success: true,
      server_id: '1000',
    })
  })

  it('keeps Book POST successful and logs a provider failure', async () => {
    subscribeToDemoAuthor({ authorId: 2, phone: '79995550102' })
    server.use(
      http.post('http://book-catalog.test/__demo/sms/send', () =>
        HttpResponse.json(
          {
            success: false,
            provider: 'smspilot',
            emulated: true,
            message: 'Emulator temporarily unavailable.',
          },
          { status: 502 },
        ),
      ),
    )

    const response = await createBook({ authorIds: [2] })
    const entries = await waitForSmsLog((items) => items.length === 1)

    expect(response.status).toBe(201)
    expect(entries[0]).toMatchObject({
      success: false,
      error: 'Emulator temporarily unavailable.',
    })
  })

  it('does not call the bridge when the new book has no subscribers', async () => {
    const bridgeRequest = vi.fn()
    server.use(
      http.post('http://book-catalog.test/__demo/sms/send', () => {
        bridgeRequest()
        return HttpResponse.json({ success: true, provider: 'smspilot', emulated: true })
      }),
    )

    const response = await createBook({ authorIds: [4] })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(response.status).toBe(201)
    expect(bridgeRequest).not.toHaveBeenCalled()
    expect(getDemoSmsLog()).toEqual([])
  })
})

describe('MSW demo author mutations and relations', () => {
  it('supports the author create, update, detail, and delete flow', async () => {
    const createResponse = await fetch(`${API_URL}/authors`, {
      method: 'POST',
      headers: { ...authorizationHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Demo Автор' }),
    })
    const createdAuthor = (await readJson(createResponse)).data

    expect(createResponse.status).toBe(201)

    await createBook({ authorIds: [createdAuthor.id], title: 'Книга Demo Автора' })

    const detailResponse = await fetch(`${API_URL}/authors/${createdAuthor.id}`)
    const authorDetail = (await readJson(detailResponse)).data

    expect(authorDetail.books).toEqual([
      expect.objectContaining({ title: 'Книга Demo Автора', year: 2031 }),
    ])

    const updateResponse = await fetch(`${API_URL}/authors/${createdAuthor.id}`, {
      method: 'PUT',
      headers: { ...authorizationHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Обновлённый Demo Автор' }),
    })
    const updatedAuthor = (await readJson(updateResponse)).data

    expect(updatedAuthor.full_name).toBe('Обновлённый Demo Автор')

    const deleteResponse = await fetch(`${API_URL}/authors/${createdAuthor.id}`, {
      method: 'DELETE',
      headers: authorizationHeaders,
    })
    const deletedAuthorResponse = await fetch(`${API_URL}/authors/${createdAuthor.id}`)

    expect(deleteResponse.status).toBe(204)
    expect(deletedAuthorResponse.status).toBe(404)
  })
})

describe('MSW demo report and reset', () => {
  it('computes TOP-10 from current relations and reflects book CRUD', async () => {
    const initialResponse = await fetch(`${API_URL}/reports/top-authors?year=2025`)
    const initialReport = (await readJson(initialResponse)).data
    const state = getMockDatabase()
    const expectedAuthorOneCount = state.books.filter(
      (book) => book.year === 2025 && book.author_ids.includes(1),
    ).length
    const initialAuthorOne = initialReport.items.find((item) => item.author_id === 1)

    expect(initialReport.items).toHaveLength(10)
    expect(initialAuthorOne.books_count).toBe(expectedAuthorOneCount)

    await createBook({ year: 2035, authorIds: [1], title: 'Книга для отчёта' })

    const changedResponse = await fetch(`${API_URL}/reports/top-authors?year=2035`)
    const changedReport = (await readJson(changedResponse)).data

    expect(changedReport).toEqual({
      year: 2035,
      items: [
        {
          rank: 1,
          author_id: 1,
          full_name: 'Алексей Воронцов',
          books_count: 1,
        },
      ],
    })
  })

  it('restores deterministic seed data through resetMockDatabase', async () => {
    await fetch(`${API_URL}/authors`, {
      method: 'POST',
      headers: { ...authorizationHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Временный автор' }),
    })
    await createBook()
    subscribeToDemoAuthor({ authorId: 1, phone: '79991234567' })
    appendDemoSmsLog({
      phone: '79991234567',
      book_id: 100,
      book_title: 'Temporary',
      author_ids: [1],
      author_names: ['Temporary Author'],
      success: true,
      server_id: '1000',
    })

    resetMockDatabase()

    const authorsResponse = await fetch(`${API_URL}/authors?page=1&per-page=100`)
    const booksResponse = await fetch(`${API_URL}/books?page=1&per-page=100`)
    const authors = (await readJson(authorsResponse)).data
    const books = (await readJson(booksResponse)).data

    expect(authors.pagination.total).toBe(SEED_AUTHOR_COUNT)
    expect(books.pagination.total).toBe(SEED_BOOK_COUNT)
    expect(getMockDatabase()).toMatchObject({
      nextAuthorId: SEED_AUTHOR_COUNT + 1,
      nextBookId: SEED_BOOK_COUNT + 1,
    })
    expect(getDemoSubscriptions()).toEqual([])
    expect(getDemoSmsLog()).toEqual([])
  })
})
