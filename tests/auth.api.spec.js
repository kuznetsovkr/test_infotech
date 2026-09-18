import { afterEach, describe, expect, it, vi } from 'vitest'

import { login } from '../src/api/auth.api'
import httpClient from '../src/api/http'

describe('auth API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('отправляет credentials только в POST /auth/login и сохраняет response shape', async () => {
    const credentials = {
      username: 'reviewer',
      password: 'not-persisted',
    }
    const responseBody = {
      success: true,
      data: {
        token: 'access-token',
        expires_at: '2099-01-01T00:00:00.000Z',
        user: { id: 1, username: 'reviewer', role: 'user' },
      },
    }
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: responseBody })

    await expect(login(credentials)).resolves.toBe(responseBody)
    expect(postSpy).toHaveBeenCalledWith('/auth/login', credentials)
  })
})
