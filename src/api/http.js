import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v1'

const httpClient = axios.create({
  baseURL: apiBaseUrl,
})

export function installAuthInterceptors(client, { getToken, onUnauthorized }) {
  const requestInterceptorId = client.interceptors.request.use((config) => {
    const token = getToken()

    if (token) {
      if (typeof config.headers?.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`)
      } else {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        }
      }
    }

    return config
  })

  const responseInterceptorId = client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        onUnauthorized()
      }

      return Promise.reject(error)
    },
  )

  return () => {
    client.interceptors.request.eject(requestInterceptorId)
    client.interceptors.response.eject(responseInterceptorId)
  }
}

export default httpClient
