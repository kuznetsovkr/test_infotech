<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getAuthors } from '../api/authors.api'
import { isRequestCanceled } from '../api/errors'
import AppPagination from '../components/common/AppPagination.vue'
import EmptyState from '../components/common/EmptyState.vue'
import ErrorAlert from '../components/common/ErrorAlert.vue'
import LoadingState from '../components/common/LoadingState.vue'
import { useLatestRequest } from '../composables/useLatestRequest'
import {
  AUTHORS_QUERY_KEYS,
  hasNormalizedQuery,
  mergeNormalizedQuery,
  normalizeAuthorsQuery,
} from '../router/publicQuery'

const AUTHORS_PER_PAGE = 20

const route = useRoute()
const router = useRouter()
const latestRequest = useLatestRequest()

const authors = ref([])
const pagination = ref({ page: 1, totalPages: 0 })
const searchInput = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const normalizedRoute = computed(() => normalizeAuthorsQuery(route.query))

async function loadAuthors(filters = normalizedRoute.value.filters) {
  const request = latestRequest.begin()
  isLoading.value = true
  errorMessage.value = ''
  authors.value = []

  try {
    const response = await getAuthors({
      page: filters.page,
      perPage: AUTHORS_PER_PAGE,
      search: filters.search,
      signal: request.signal,
    })

    if (!request.isLatest()) {
      return
    }

    authors.value = response.items
    pagination.value = response.pagination
  } catch (error) {
    if (request.isLatest() && !isRequestCanceled(error)) {
      errorMessage.value = 'Не удалось загрузить список авторов. Повторите попытку.'
    }
  } finally {
    if (request.isLatest()) {
      isLoading.value = false
    }
  }
}

watch(
  () => route.query,
  async (query) => {
    const normalized = normalizeAuthorsQuery(query)
    searchInput.value = normalized.filters.search

    if (!hasNormalizedQuery(query, normalized.query, AUTHORS_QUERY_KEYS)) {
      latestRequest.cancel()
      await router.replace({
        query: mergeNormalizedQuery(query, normalized.query, AUTHORS_QUERY_KEYS),
      })
      return
    }

    await loadAuthors(normalized.filters)
  },
  { deep: true, immediate: true },
)

async function submitSearch() {
  await router.push({
    name: 'authors',
    query: {
      ...(searchInput.value.trim() ? { search: searchInput.value.trim() } : {}),
      page: '1',
    },
  })
}

async function clearSearch() {
  searchInput.value = ''
  await router.push({ name: 'authors', query: { page: '1' } })
}

async function changePage(page) {
  await router.push({
    name: 'authors',
    query: {
      ...normalizedRoute.value.query,
      page: String(page),
    },
  })
}
</script>

<template>
  <section aria-labelledby="authors-title">
    <h1 id="authors-title" class="display-6 fw-bold mb-4">Авторы</h1>

    <form
      class="row g-2 align-items-end border rounded bg-white p-3 mb-4"
      @submit.prevent="submitSearch"
    >
      <div class="col-12 col-md">
        <label class="form-label" for="author-search">Поиск автора</label>
        <input id="author-search" v-model="searchInput" class="form-control" type="search" />
      </div>
      <div class="col-12 col-md-auto d-flex gap-2">
        <button class="btn btn-primary flex-grow-1" type="submit">Найти</button>
        <button class="btn btn-outline-secondary" type="button" @click="clearSearch">
          Сбросить
        </button>
      </div>
    </form>

    <LoadingState v-if="isLoading" message="Загрузка авторов…" />
    <ErrorAlert v-else-if="errorMessage" :message="errorMessage" @retry="loadAuthors()" />
    <EmptyState v-else-if="authors.length === 0" message="Авторы не найдены." />

    <template v-else>
      <ul class="list-group shadow-sm" data-testid="authors-list">
        <li
          v-for="author in authors"
          :key="author.id ?? author.full_name"
          class="list-group-item py-3"
        >
          <RouterLink v-if="Number.isInteger(author.id)" :to="`/authors/${author.id}`">
            {{ author.full_name || 'Имя автора не указано' }}
          </RouterLink>
          <span v-else>{{ author.full_name || 'Имя автора не указано' }}</span>
        </li>
      </ul>

      <AppPagination
        :current-page="pagination.page"
        :total-pages="pagination.totalPages"
        label="Страницы списка авторов"
        @change="changePage"
      />
    </template>
  </section>
</template>
