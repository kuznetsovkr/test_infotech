import { http, HttpResponse } from 'msw'

import { getMockDatabase, mutateMockDatabase } from './db'
import { DEMO_CREDENTIALS, DEMO_TOKEN } from './seed'

const API_PATH = '*/api/v1'

function success(data, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function apiError(status, errors) {
  return HttpResponse.json({ success: false, errors }, { status })
}

function fieldError(field, message) {
  return { field, message }
}

function unauthorized() {
  return apiError(401, [fieldError('authorization', 'Требуется авторизация.')])
}

function notFound(entityName) {
  return apiError(404, [fieldError('id', `${entityName} не найдена.`)])
}

function isAuthorized(request) {
  return request.headers.get('authorization') === `Bearer ${DEMO_TOKEN}`
}

function parseInteger(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!/^-?\d+$/.test(normalizedValue)) {
    return null
  }

  const parsedValue = Number(normalizedValue)

  return Number.isSafeInteger(parsedValue) ? parsedValue : null
}

function parsePositiveInteger(value, fallback) {
  const parsedValue = parseInteger(value)

  return parsedValue !== null && parsedValue > 0 ? parsedValue : fallback
}

function parseEntityId(value) {
  const parsedValue = parseInteger(value)

  return parsedValue !== null && parsedValue > 0 ? parsedValue : null
}

function paginate(items, searchParams) {
  const page = parsePositiveInteger(searchParams.get('page'), 1)
  const perPage = parsePositiveInteger(searchParams.get('per-page'), 20)
  const total = items.length
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage)
  const offset = (page - 1) * perPage

  return {
    items: items.slice(offset, offset + perPage),
    pagination: {
      total,
      page,
      per_page: perPage,
      total_pages: totalPages,
    },
  }
}

function findAuthor(state, id) {
  return state.authors.find((author) => author.id === id)
}

function findBook(state, id) {
  return state.books.find((book) => book.id === id)
}

function serializeBook(state, book) {
  return {
    id: book.id,
    title: book.title,
    year: book.year,
    description: book.description,
    isbn: book.isbn,
    cover_url: book.cover_url,
    authors: book.author_ids
      .map((authorId) => findAuthor(state, authorId))
      .filter(Boolean)
      .map((author) => ({ id: author.id, full_name: author.full_name })),
  }
}

function serializeAuthor(state, author) {
  return {
    id: author.id,
    full_name: author.full_name,
    books: state.books
      .filter((book) => book.author_ids.includes(author.id))
      .map((book) => ({ id: book.id, title: book.title, year: book.year })),
  }
}

function getFormString(formData, field) {
  const value = formData.get(field)

  return typeof value === 'string' ? value.trim() : ''
}

function getFormAuthorIds(formData) {
  const parsedIds = formData.getAll('author_ids[]').map(parseInteger)

  return {
    authorIds: [...new Set(parsedIds.filter((id) => id !== null))],
    hasInvalidId: parsedIds.some((id) => id === null),
  }
}

function isFile(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.arrayBuffer === 'function' &&
    typeof value.size === 'number' &&
    value.size > 0
  )
}

function validateAuthorIds(state, authorIds) {
  if (authorIds.length === 0) {
    return 'Выберите хотя бы одного автора.'
  }

  if (authorIds.some((authorId) => !findAuthor(state, authorId))) {
    return 'Один или несколько авторов не существуют.'
  }

  return null
}

function parseBookForm(state, formData) {
  const title = getFormString(formData, 'title')
  const year = parseInteger(getFormString(formData, 'year'))
  const { authorIds, hasInvalidId } = getFormAuthorIds(formData)
  const cover = formData.get('cover')
  const errors = []

  if (!title) {
    errors.push(fieldError('title', 'Название обязательно.'))
  }

  if (year === null) {
    errors.push(fieldError('year', 'Год должен быть целым числом.'))
  }

  const authorIdsError = hasInvalidId
    ? 'Идентификаторы авторов должны быть целыми числами.'
    : validateAuthorIds(state, authorIds)

  if (authorIdsError) {
    errors.push(fieldError('author_ids', authorIdsError))
  }

  if (!isFile(cover)) {
    errors.push(fieldError('cover', 'Обложка обязательна.'))
  }

  return {
    errors,
    value: {
      title,
      year,
      description: getFormString(formData, 'description'),
      isbn: getFormString(formData, 'isbn'),
      author_ids: authorIds,
      cover,
    },
  }
}

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return globalThis.btoa(binary)
}

async function fileToDataUrl(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = file.type || 'application/octet-stream'

  return `data:${mimeType};base64,${bytesToBase64(bytes)}`
}

function validatePatch(state, payload) {
  const errors = []
  const changes = {}

  if (Object.hasOwn(payload, 'title')) {
    const title = typeof payload.title === 'string' ? payload.title.trim() : ''

    if (!title) {
      errors.push(fieldError('title', 'Название обязательно.'))
    } else {
      changes.title = title
    }
  }

  if (Object.hasOwn(payload, 'year')) {
    if (!Number.isInteger(payload.year)) {
      errors.push(fieldError('year', 'Год должен быть целым числом.'))
    } else {
      changes.year = payload.year
    }
  }

  for (const field of ['description', 'isbn']) {
    if (Object.hasOwn(payload, field)) {
      if (typeof payload[field] !== 'string') {
        errors.push(fieldError(field, 'Значение должно быть строкой.'))
      } else {
        changes[field] = payload[field].trim()
      }
    }
  }

  if (Object.hasOwn(payload, 'author_ids')) {
    const hasValidShape =
      Array.isArray(payload.author_ids) && payload.author_ids.every(Number.isInteger)
    const authorIds = hasValidShape ? [...new Set(payload.author_ids)] : []
    const authorIdsError = hasValidShape
      ? validateAuthorIds(state, authorIds)
      : 'Идентификаторы авторов должны быть целыми числами.'

    if (authorIdsError) {
      errors.push(fieldError('author_ids', authorIdsError))
    } else {
      changes.author_ids = authorIds
    }
  }

  return { errors, changes }
}

const loginHandler = http.post(`${API_PATH}/auth/login`, async ({ request }) => {
  let credentials

  try {
    credentials = await request.json()
  } catch {
    credentials = null
  }

  if (
    credentials?.username !== DEMO_CREDENTIALS.username ||
    credentials?.password !== DEMO_CREDENTIALS.password
  ) {
    return apiError(401, [fieldError('credentials', 'Неверное имя пользователя или пароль.')])
  }

  return success({
    token: DEMO_TOKEN,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    user: {
      id: 1,
      username: DEMO_CREDENTIALS.username,
      role: 'user',
    },
  })
})

const getBooksHandler = http.get(`${API_PATH}/books`, ({ request }) => {
  const state = getMockDatabase()
  const url = new URL(request.url)
  const search = (url.searchParams.get('search') || '').trim().toLocaleLowerCase()
  const year = parseInteger(url.searchParams.get('year'))
  const authorId = parseInteger(url.searchParams.get('author_id'))

  const filteredBooks = state.books.filter((book) => {
    const matchesSearch =
      !search ||
      book.title.toLocaleLowerCase().includes(search) ||
      book.isbn.toLocaleLowerCase().includes(search)
    const matchesYear = year === null || book.year === year
    const matchesAuthor = authorId === null || book.author_ids.includes(authorId)

    return matchesSearch && matchesYear && matchesAuthor
  })
  const result = paginate(filteredBooks, url.searchParams)

  return success({
    items: result.items.map((book) => serializeBook(state, book)),
    pagination: result.pagination,
  })
})

const createBookHandler = http.post(`${API_PATH}/books`, async ({ request }) => {
  if (!isAuthorized(request)) {
    return unauthorized()
  }

  const state = getMockDatabase()
  const formData = await request.formData()
  const parsedBook = parseBookForm(state, formData)

  if (parsedBook.errors.length > 0) {
    return apiError(422, parsedBook.errors)
  }

  const coverUrl = await fileToDataUrl(parsedBook.value.cover)
  const book = mutateMockDatabase((database) => {
    const createdBook = {
      id: database.nextBookId,
      title: parsedBook.value.title,
      year: parsedBook.value.year,
      description: parsedBook.value.description,
      isbn: parsedBook.value.isbn,
      cover_url: coverUrl,
      author_ids: parsedBook.value.author_ids,
    }

    database.nextBookId += 1
    database.books.push(createdBook)

    return createdBook
  })

  return success(serializeBook(getMockDatabase(), book), 201)
})

const getBookHandler = http.get(`${API_PATH}/books/:id`, ({ params }) => {
  const state = getMockDatabase()
  const book = findBook(state, parseEntityId(params.id))

  return book ? success(serializeBook(state, book)) : notFound('Книга')
})

const replaceBookHandler = http.put(`${API_PATH}/books/:id`, async ({ request, params }) => {
  if (!isAuthorized(request)) {
    return unauthorized()
  }

  const state = getMockDatabase()
  const book = findBook(state, parseEntityId(params.id))

  if (!book) {
    return notFound('Книга')
  }

  const formData = await request.formData()
  const parsedBook = parseBookForm(state, formData)

  if (parsedBook.errors.length > 0) {
    return apiError(422, parsedBook.errors)
  }

  const coverUrl = await fileToDataUrl(parsedBook.value.cover)

  mutateMockDatabase(() => {
    Object.assign(book, {
      title: parsedBook.value.title,
      year: parsedBook.value.year,
      description: parsedBook.value.description,
      isbn: parsedBook.value.isbn,
      cover_url: coverUrl,
      author_ids: parsedBook.value.author_ids,
    })
  })

  return success(serializeBook(getMockDatabase(), book))
})

const patchBookHandler = http.patch(`${API_PATH}/books/:id`, async ({ request, params }) => {
  if (!isAuthorized(request)) {
    return unauthorized()
  }

  const state = getMockDatabase()
  const book = findBook(state, parseEntityId(params.id))

  if (!book) {
    return notFound('Книга')
  }

  let payload

  try {
    payload = await request.json()
  } catch {
    payload = null
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return apiError(422, [fieldError('request', 'Ожидается JSON-объект.')])
  }

  const validation = validatePatch(state, payload)

  if (validation.errors.length > 0) {
    return apiError(422, validation.errors)
  }

  mutateMockDatabase(() => {
    Object.assign(book, validation.changes)
  })

  return success(serializeBook(getMockDatabase(), book))
})

const deleteBookHandler = http.delete(`${API_PATH}/books/:id`, ({ request, params }) => {
  if (!isAuthorized(request)) {
    return unauthorized()
  }

  const state = getMockDatabase()
  const bookIndex = state.books.findIndex((book) => book.id === parseEntityId(params.id))

  if (bookIndex === -1) {
    return notFound('Книга')
  }

  mutateMockDatabase((database) => {
    database.books.splice(bookIndex, 1)
  })

  return new HttpResponse(null, { status: 204 })
})

const getAuthorsHandler = http.get(`${API_PATH}/authors`, ({ request }) => {
  const state = getMockDatabase()
  const url = new URL(request.url)
  const search = (url.searchParams.get('search') || '').trim().toLocaleLowerCase()
  const filteredAuthors = state.authors.filter(
    (author) => !search || author.full_name.toLocaleLowerCase().includes(search),
  )
  const result = paginate(filteredAuthors, url.searchParams)

  return success({
    items: result.items.map((author) => ({
      id: author.id,
      full_name: author.full_name,
    })),
    pagination: result.pagination,
  })
})

const createAuthorHandler = http.post(`${API_PATH}/authors`, async ({ request }) => {
  if (!isAuthorized(request)) {
    return unauthorized()
  }

  let payload

  try {
    payload = await request.json()
  } catch {
    payload = null
  }

  const fullName = typeof payload?.full_name === 'string' ? payload.full_name.trim() : ''

  if (!fullName) {
    return apiError(422, [fieldError('full_name', 'ФИО обязательно.')])
  }

  const author = mutateMockDatabase((state) => {
    const createdAuthor = { id: state.nextAuthorId, full_name: fullName }
    state.nextAuthorId += 1
    state.authors.push(createdAuthor)

    return createdAuthor
  })

  return success(serializeAuthor(getMockDatabase(), author), 201)
})

const getAuthorHandler = http.get(`${API_PATH}/authors/:id`, ({ params }) => {
  const state = getMockDatabase()
  const author = findAuthor(state, parseEntityId(params.id))

  return author ? success(serializeAuthor(state, author)) : notFound('Автор')
})

const updateAuthorHandler = http.put(`${API_PATH}/authors/:id`, async ({ request, params }) => {
  if (!isAuthorized(request)) {
    return unauthorized()
  }

  const state = getMockDatabase()
  const author = findAuthor(state, parseEntityId(params.id))

  if (!author) {
    return notFound('Автор')
  }

  let payload

  try {
    payload = await request.json()
  } catch {
    payload = null
  }

  const fullName = typeof payload?.full_name === 'string' ? payload.full_name.trim() : ''

  if (!fullName) {
    return apiError(422, [fieldError('full_name', 'ФИО обязательно.')])
  }

  mutateMockDatabase(() => {
    author.full_name = fullName
  })

  return success(serializeAuthor(getMockDatabase(), author))
})

const deleteAuthorHandler = http.delete(`${API_PATH}/authors/:id`, ({ request, params }) => {
  if (!isAuthorized(request)) {
    return unauthorized()
  }

  const state = getMockDatabase()
  const authorId = parseEntityId(params.id)
  const authorIndex = state.authors.findIndex((author) => author.id === authorId)

  if (authorIndex === -1) {
    return notFound('Автор')
  }

  mutateMockDatabase((database) => {
    database.authors.splice(authorIndex, 1)
    database.books = database.books
      .map((book) => ({
        ...book,
        author_ids: book.author_ids.filter((bookAuthorId) => bookAuthorId !== authorId),
      }))
      .filter((book) => book.author_ids.length > 0)
  })

  return new HttpResponse(null, { status: 204 })
})

const topAuthorsHandler = http.get(`${API_PATH}/reports/top-authors`, ({ request }) => {
  const state = getMockDatabase()
  const url = new URL(request.url)
  const year = parseInteger(url.searchParams.get('year'))

  if (year === null) {
    return apiError(400, [fieldError('year', 'Год должен быть целым числом.')])
  }

  const counts = new Map()

  for (const book of state.books) {
    if (book.year !== year) {
      continue
    }

    for (const authorId of book.author_ids) {
      counts.set(authorId, (counts.get(authorId) || 0) + 1)
    }
  }

  const items = [...counts.entries()]
    .map(([authorId, booksCount]) => ({
      author: findAuthor(state, authorId),
      booksCount,
    }))
    .filter((item) => item.author)
    .sort((left, right) => right.booksCount - left.booksCount || left.author.id - right.author.id)
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      author_id: item.author.id,
      full_name: item.author.full_name,
      books_count: item.booksCount,
    }))

  return success({ year, items })
})

export const handlers = [
  loginHandler,
  getBooksHandler,
  createBookHandler,
  getBookHandler,
  replaceBookHandler,
  patchBookHandler,
  deleteBookHandler,
  getAuthorsHandler,
  createAuthorHandler,
  getAuthorHandler,
  updateAuthorHandler,
  deleteAuthorHandler,
  topAuthorsHandler,
]
