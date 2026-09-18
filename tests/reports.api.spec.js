import { afterEach, describe, expect, it, vi } from 'vitest'

import httpClient from '../src/api/http'
import { getTopAuthors } from '../src/api/reports.api'

describe('reports API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('передаёт только year в GET /reports/top-authors', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: { year: 2025, items: [] },
      },
    })

    const result = await getTopAuthors(2025)

    expect(getSpy).toHaveBeenCalledWith('/reports/top-authors', {
      params: { year: 2025 },
    })
    expect(result).toEqual({ year: 2025, items: [] })
  })
})
