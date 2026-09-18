<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getAuthor } from '../api/authors.api'
import { getHttpStatus, isRequestCanceled } from '../api/errors'
import EmptyState from '../components/common/EmptyState.vue'
import ErrorAlert from '../components/common/ErrorAlert.vue'
import LoadingState from '../components/common/LoadingState.vue'
import { useLatestRequest } from '../composables/useLatestRequest'
import { parsePositiveInteger } from '../router/publicQuery'

const route = useRoute()
const latestRequest = useLatestRequest()

const author = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')
const isNotFound = ref(false)

async function loadAuthor() {
  const id = parsePositiveInteger(route.params.id)
  author.value = null
  errorMessage.value = ''
  isNotFound.value = false

  if (!id) {
    latestRequest.cancel()
    isLoading.value = false
    isNotFound.value = true
    return
  }

  const request = latestRequest.begin()
  isLoading.value = true

  try {
    const response = await getAuthor(id, { signal: request.signal })

    if (request.isLatest()) {
      author.value = response
    }
  } catch (error) {
    if (!request.isLatest() || isRequestCanceled(error)) {
      return
    }

    if (getHttpStatus(error) === 404) {
      isNotFound.value = true
    } else {
      errorMessage.value = 'Не удалось загрузить информацию об авторе.'
    }
  } finally {
    if (request.isLatest()) {
      isLoading.value = false
    }
  }
}

watch(() => route.params.id, loadAuthor, { immediate: true })
</script>

<template>
  <LoadingState v-if="isLoading" message="Загрузка автора…" />

  <section v-else-if="isNotFound" aria-labelledby="author-not-found-title">
    <h1 id="author-not-found-title" class="h2">Автор не найден</h1>
    <p class="text-body-secondary">Проверьте адрес или вернитесь к списку авторов.</p>
    <RouterLink class="btn btn-primary" to="/authors">К списку авторов</RouterLink>
  </section>

  <ErrorAlert
    v-else-if="errorMessage"
    :message="errorMessage"
    retry-label="Повторить загрузку"
    @retry="loadAuthor"
  />

  <article v-else-if="author" aria-labelledby="author-title">
    <h1 id="author-title" class="display-6 fw-bold mb-4">
      {{ author.full_name || 'Имя автора не указано' }}
    </h1>

    <section aria-labelledby="author-books-title">
      <h2 id="author-books-title" class="h3 mb-3">Книги автора</h2>
      <EmptyState
        v-if="!Array.isArray(author.books) || author.books.length === 0"
        message="У автора нет книг в каталоге."
      />
      <ul v-else class="list-group shadow-sm" data-testid="author-books">
        <li v-for="book in author.books" :key="book.id ?? book.title" class="list-group-item py-3">
          <RouterLink v-if="Number.isInteger(book.id)" :to="`/books/${book.id}`">
            {{ book.title || 'Название не указано' }}
          </RouterLink>
          <span v-else>{{ book.title || 'Название не указано' }}</span>
          <span v-if="Number.isInteger(book.year)" class="text-body-secondary">
            — {{ book.year }}</span
          >
        </li>
      </ul>
    </section>
  </article>
</template>
