const BOOKS_QUERY_KEYS = ['search', 'year', 'author_id', 'page']
const AUTHORS_QUERY_KEYS = ['search', 'page']

function getSingleValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function parseInteger(value) {
  const candidate = getSingleValue(value)

  if (typeof candidate === 'number' && Number.isInteger(candidate)) {
    return candidate
  }

  if (typeof candidate !== 'string' || !/^-?\d+$/.test(candidate.trim())) {
    return null
  }

  const parsed = Number(candidate)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function parsePositiveInteger(value, fallback = null) {
  const parsed = parseInteger(value)
  return parsed !== null && parsed > 0 ? parsed : fallback
}

export function parseOptionalInteger(value) {
  const candidate = getSingleValue(value)

  if (candidate === undefined || candidate === null || candidate === '') {
    return null
  }

  return parseInteger(candidate)
}

function parseSearch(value) {
  const candidate = getSingleValue(value)
  return typeof candidate === 'string' ? candidate.trim() : ''
}

export function normalizeBooksQuery(query) {
  const filters = {
    authorId: parsePositiveInteger(query.author_id),
    page: parsePositiveInteger(query.page, 1),
    search: parseSearch(query.search),
    year: parseOptionalInteger(query.year),
  }

  return {
    filters,
    query: {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.year !== null ? { year: String(filters.year) } : {}),
      ...(filters.authorId !== null ? { author_id: String(filters.authorId) } : {}),
      page: String(filters.page),
    },
  }
}

export function normalizeAuthorsQuery(query) {
  const filters = {
    page: parsePositiveInteger(query.page, 1),
    search: parseSearch(query.search),
  }

  return {
    filters,
    query: {
      ...(filters.search ? { search: filters.search } : {}),
      page: String(filters.page),
    },
  }
}

export function hasNormalizedQuery(currentQuery, normalizedQuery, keys) {
  return keys.every((key) => {
    const current = getSingleValue(currentQuery[key])
    const normalized = normalizedQuery[key]

    return current === normalized || (current === undefined && normalized === undefined)
  })
}

export function mergeNormalizedQuery(currentQuery, normalizedQuery, keys) {
  const mergedQuery = { ...currentQuery }

  keys.forEach((key) => {
    delete mergedQuery[key]
  })

  return {
    ...mergedQuery,
    ...normalizedQuery,
  }
}

export { AUTHORS_QUERY_KEYS, BOOKS_QUERY_KEYS }
