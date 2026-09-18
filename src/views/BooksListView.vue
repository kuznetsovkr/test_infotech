<script setup>
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { computed, ref, watch } from 'vue'

import { getBooks } from '../api/books.api'
import { isRequestCanceled } from '../api/errors'
import AuthorFilter from '../components/authors/AuthorFilter.vue'
import BookCard from '../components/books/BookCard.vue'
import AppPagination from '../components/common/AppPagination.vue'
import EmptyState from '../components/common/EmptyState.vue'
import ErrorAlert from '../components/common/ErrorAlert.vue'
import LoadingState from '../components/common/LoadingState.vue'
import { useLatestRequest } from '../composables/useLatestRequest'
import {
  BOOKS_QUERY_KEYS,
  hasNormalizedQuery,
  mergeNormalizedQuery,
  normalizeBooksQuery,
  parseOptionalInteger,
} from '../router/publicQuery'
import { useAuthStore } from '../stores/auth'

const BOOKS_PER_PAGE = 12

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const latestRequest = useLatestRequest()

const books = ref([])
const pagination = ref({ page: 1, totalPages: 0 })
const isLoading = ref(false)
const errorMessage = ref('')
const filterError = ref('')
const searchInput = ref('')
const yearInput = ref('')

const normalizedRoute = computed(() => normalizeBooksQuery(route.query))
const selectedAuthorId = computed(() => normalizedRoute.value.filters.authorId)

async function loadBooks(filters = normalizedRoute.value.filters) {
  const request = latestRequest.begin()
  isLoading.value = true
  errorMessage.value = ''
  books.value = []

  try {
    const response = await getBooks({
      page: filters.page,
      perPage: BOOKS_PER_PAGE,
      authorId: filters.authorId,
      year: filters.year,
      search: filters.search,
      signal: request.signal,
    })

    if (!request.isLatest()) {
      return
    }

    books.value = response.items
    pagination.value = response.pagination
  } catch (error) {
    if (request.isLatest() && !isRequestCanceled(error)) {
      errorMessage.value = 'Не удалось загрузить каталог книг. Повторите попытку.'
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
    const normalized = normalizeBooksQuery(query)
    searchInput.value = normalized.filters.search
    yearInput.value = normalized.filters.year ?? ''
    filterError.value = ''

    if (!hasNormalizedQuery(query, normalized.query, BOOKS_QUERY_KEYS)) {
      latestRequest.cancel()
      await router.replace({
        query: mergeNormalizedQuery(query, normalized.query, BOOKS_QUERY_KEYS),
      })
      return
    }

    await loadBooks(normalized.filters)
  },
  { deep: true, immediate: true },
)

onBeforeRouteUpdate(() => {
  latestRequest.cancel()
})

function buildFilterQuery(overrides = {}) {
  const current = normalizeBooksQuery(route.query).query

  return {
    ...current,
    ...overrides,
  }
}

async function applyFilters() {
  const rawYear = String(yearInput.value).trim()
  const year = parseOptionalInteger(rawYear)

  if (rawYear && year === null) {
    filterError.value = 'Год должен быть целым числом.'
    return
  }

  filterError.value = ''
  const query = buildFilterQuery({
    search: searchInput.value.trim() || undefined,
    year: year === null ? undefined : String(year),
    page: '1',
  })

  await router.push({ name: 'books', query })
}

async function applyAuthor(authorId) {
  await router.push({
    name: 'books',
    query: buildFilterQuery({
      author_id: authorId ? String(authorId) : undefined,
      page: '1',
    }),
  })
}

async function clearFilters() {
  searchInput.value = ''
  yearInput.value = ''
  filterError.value = ''
  await router.push({ name: 'books', query: { page: '1' } })
}

async function changePage(page) {
  await router.push({
    name: 'books',
    query: buildFilterQuery({ page: String(page) }),
  })
}
</script>

<template>
  <section aria-labelledby="books-title">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h1 id="books-title" class="display-6 fw-bold mb-1">Каталог книг</h1>
        <p class="text-body-secondary mb-0">Публичный список книг из API.</p>
      </div>
      <RouterLink
        v-if="authStore.isAuthenticated"
        class="btn btn-primary"
        :to="{ name: 'book-create' }"
      >
        Добавить книгу
      </RouterLink>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-12 col-lg-7">
        <form
          class="border rounded bg-white p-3 h-100"
          data-testid="book-filters"
          @submit.prevent="applyFilters"
        >
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-7">
              <label class="form-label" for="book-search">Поиск</label>
              <input
                id="book-search"
                v-model="searchInput"
                class="form-control"
                type="search"
                placeholder="Название, описание или ISBN"
              />
            </div>
            <div class="col-12 col-md-5">
              <label class="form-label" for="book-year">Год выпуска</label>
              <input
                id="book-year"
                v-model="yearInput"
                class="form-control"
                type="number"
                step="1"
              />
            </div>
            <div class="col-12 d-flex flex-wrap gap-2">
              <button class="btn btn-primary" type="submit">Применить</button>
              <button class="btn btn-outline-secondary" type="button" @click="clearFilters">
                Сбросить фильтры
              </button>
            </div>
          </div>
          <p v-if="filterError" class="text-danger small mt-2 mb-0" role="alert">
            {{ filterError }}
          </p>
        </form>
      </div>
      <div class="col-12 col-lg-5">
        <AuthorFilter :model-value="selectedAuthorId" @update:model-value="applyAuthor" />
      </div>
    </div>

    <LoadingState v-if="isLoading" message="Загрузка книг…" />
    <ErrorAlert v-else-if="errorMessage" :message="errorMessage" @retry="loadBooks()" />
    <EmptyState v-else-if="books.length === 0" message="По заданным условиям книги не найдены." />

    <template v-else>
      <div
        class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-4"
        data-testid="books-list"
      >
        <div v-for="book in books" :key="book.id ?? book.title" class="col">
          <BookCard :book="book" />
        </div>
      </div>

      <AppPagination
        :current-page="pagination.page"
        :total-pages="pagination.totalPages"
        label="Страницы каталога книг"
        @change="changePage"
      />
    </template>
  </section>
</template>
