<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell d-flex flex-column min-vh-100">
    <header class="border-bottom bg-white">
      <nav class="navbar container" aria-label="Основная навигация">
        <RouterLink class="navbar-brand fw-semibold" to="/">Каталог книг</RouterLink>
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
