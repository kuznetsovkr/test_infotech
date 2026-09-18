import httpClient from './http'

export async function login(credentials) {
  const response = await httpClient.post('/auth/login', credentials)

  return response.data
}
