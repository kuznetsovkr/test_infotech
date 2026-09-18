import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v1'

const httpClient = axios.create({
  baseURL: apiBaseUrl,
})

export default httpClient
