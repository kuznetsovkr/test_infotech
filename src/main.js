import { createPinia } from 'pinia'
import { createApp } from 'vue'

import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/main.scss'

import App from './App.vue'
import httpClient, { installAuthInterceptors } from './api/http'
import router, { handleUnauthorized, registerAuthGuards } from './router'
import { useAuthStore } from './stores/auth'

async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK_API !== 'true') {
    return
  }

  const { startMockWorker } = await import('./mocks/browser')
  await startMockWorker()
}

async function bootstrap() {
  await enableMocking()

  const app = createApp(App)
  const pinia = createPinia()
  const authStore = useAuthStore(pinia)

  authStore.restoreSession()
  registerAuthGuards(router, pinia)

  installAuthInterceptors(httpClient, {
    getToken: () => {
      if (!authStore.isAuthenticated) {
        authStore.logout()
        return null
      }

      return authStore.token
    },
    onUnauthorized: () => {
      void handleUnauthorized(router, authStore)
    },
  })

  app.use(pinia)
  app.use(router)
  app.mount('#app')
}

void bootstrap()
