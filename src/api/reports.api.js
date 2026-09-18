import httpClient from './http'
import { normalizeEntityResponse } from './response'

export async function getTopAuthors(year, { signal } = {}) {
  const config = {
    params: { year },
  }

  if (signal) {
    config.signal = signal
  }

  const response = await httpClient.get('/reports/top-authors', config)

  return normalizeEntityResponse(response)
}
