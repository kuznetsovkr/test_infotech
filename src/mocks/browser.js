import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'

const worker = setupWorker(...handlers)

export function startMockWorker() {
  const baseUrl = import.meta.env.BASE_URL || '/'
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  return worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: `${normalizedBaseUrl}mockServiceWorker.js`,
    },
  })
}
