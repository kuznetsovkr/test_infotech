function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function createContractError(message) {
  const error = new Error(message)
  error.code = 'ERR_API_CONTRACT'

  return error
}

export function unwrapResponseData(response) {
  const payload = response?.data

  if (!isObject(payload) || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
    throw createContractError('API response does not contain a data field.')
  }

  return payload.data
}

export function normalizeEntityResponse(response) {
  const data = unwrapResponseData(response)

  if (!isObject(data)) {
    throw createContractError('API response data is not an object.')
  }

  return data
}

function toNonNegativeInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

function toPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function normalizeListResponse(response, { page, perPage }) {
  const data = unwrapResponseData(response)

  if (!isObject(data)) {
    throw createContractError('API list response data is not an object.')
  }

  const items = Array.isArray(data.items) ? data.items : []
  const pagination = isObject(data.pagination) ? data.pagination : {}

  return {
    items,
    pagination: {
      total: toNonNegativeInteger(pagination.total, items.length),
      page: toPositiveInteger(pagination.page, page),
      perPage: toPositiveInteger(pagination.per_page, perPage),
      totalPages: toNonNegativeInteger(pagination.total_pages, items.length > 0 ? 1 : 0),
    },
  }
}
