<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getBook } from '../api/books.api'
import { getHttpStatus, isRequestCanceled } from '../api/errors'
import BookCover from '../components/books/BookCover.vue'
import ErrorAlert from '../components/common/ErrorAlert.vue'
import LoadingState from '../components/common/LoadingState.vue'
import { useLatestRequest } from '../composables/useLatestRequest'
import { parsePositiveInteger } from '../router/publicQuery'

const route = useRoute()
const latestRequest = useLatestRequest()

const book = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')
const isNotFound = ref(false)

async function loadBook() {
  const id = parsePositiveInteger(route.params.id)
  book.value = null
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
    const response = await getBook(id, { signal: request.signal })

    if (request.isLatest()) {
      book.value = response
    }
  } catch (error) {
    if (!request.isLatest() || isRequestCanceled(error)) {
      return
    }

    if (getHttpStatus(error) === 404) {
      isNotFound.value = true
    } else {
      errorMessage.value = 'Не удалось загрузить информацию о книге.'
    }
  } finally {
    if (request.isLatest()) {
      isLoading.value = false
    }
  }
}

watch(() => route.params.id, loadBook, { immediate: true })
</script>

<template>
  <LoadingState v-if="isLoading" message="Загрузка книги…" />

  <section v-else-if="isNotFound" aria-labelledby="book-not-found-title">
    <h1 id="book-not-found-title" class="h2">Книга не найдена</h1>
    <p class="text-body-secondary">Проверьте адрес или вернитесь в каталог.</p>
    <RouterLink class="btn btn-primary" to="/books">К каталогу</RouterLink>
  </section>

  <ErrorAlert
    v-else-if="errorMessage"
    :message="errorMessage"
    retry-label="Повторить загрузку"
    @retry="loadBook"
  />

  <article v-else-if="book" class="row g-4" aria-labelledby="book-title">
    <div class="col-12 col-sm-5 col-lg-4">
      <BookCover :src="book.cover_url" :title="book.title" />
    </div>
    <div class="col-12 col-sm-7 col-lg-8">
      <h1 id="book-title" class="display-6 fw-bold">
        {{ book.title || 'Название не указано' }}
      </h1>

      <dl class="row mt-4">
        <dt class="col-sm-3">Год</dt>
        <dd class="col-sm-9">{{ Number.isInteger(book.year) ? book.year : 'Не указан' }}</dd>

        <dt class="col-sm-3">ISBN</dt>
        <dd class="col-sm-9">{{ book.isbn || 'Не указан' }}</dd>

        <dt class="col-sm-3">Авторы</dt>
        <dd class="col-sm-9">
          <ul v-if="Array.isArray(book.authors) && book.authors.length" class="list-unstyled mb-0">
            <li v-for="author in book.authors" :key="author.id ?? author.full_name">
              <RouterLink v-if="Number.isInteger(author.id)" :to="`/authors/${author.id}`">
                {{ author.full_name || 'Имя автора не указано' }}
              </RouterLink>
              <span v-else>{{ author.full_name || 'Имя автора не указано' }}</span>
            </li>
          </ul>
          <span v-else>Не указаны</span>
        </dd>
      </dl>

      <section aria-labelledby="book-description-title">
        <h2 id="book-description-title" class="h4">Описание</h2>
        <p class="book-description mb-0">{{ book.description || 'Описание отсутствует.' }}</p>
      </section>
    </div>
  </article>
</template>
