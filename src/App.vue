<script setup>
import { RouterLink, RouterView, useRouter } from 'vue-router'

import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()
const router = useRouter()

async function handleLogout() {
  authStore.logout()
  await router.replace({ name: 'home' })
}
</script>

<template>
  <div class="app-shell d-flex flex-column min-vh-100">
    <header class="border-bottom bg-white">
      <nav class="navbar container" aria-label="Основная навигация">
        <RouterLink class="navbar-brand fw-semibold" to="/">Каталог книг</RouterLink>

        <div class="d-flex align-items-center gap-2">
          <RouterLink v-if="authStore.isAuthenticated" class="btn btn-link" to="/account">
            Аккаунт
          </RouterLink>
          <RouterLink v-else class="btn btn-outline-primary" to="/login">Войти</RouterLink>
          <button
            v-if="authStore.isAuthenticated"
            class="btn btn-outline-secondary"
            type="button"
            @click="handleLogout"
          >
            Выйти
          </button>
        </div>
      </nav>
    </header>

    <main class="container flex-grow-1 py-5">
      <RouterView />
    </main>

    <footer class="border-top bg-white py-3">
      <div class="container text-body-secondary small">Frontend test assignment</div>
    </footer>
  </div>
</template>
