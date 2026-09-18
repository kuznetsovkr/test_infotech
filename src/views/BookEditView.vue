<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { mapBookValidationErrors } from '../api/bookErrors'
import { getBook, patchBook, replaceBook } from '../api/books.api'
import { getHttpStatus, isRequestCanceled } from '../api/errors'
import BookForm from '../components/books/BookForm.vue'
import ErrorAlert from '../components/common/ErrorAlert.vue'
import LoadingState from '../components/common/LoadingState.vue'
import { useLatestRequest } from '../composables/useLatestRequest'
import { parsePositiveInteger } from '../router/publicQuery'

const route = useRoute()
const router = useRouter()
const latestRequest = useLatestRequest()
const bookId = computed(() => parsePositiveInteger(route.params.id))

const book = ref(null)
const isLoading = ref(true)
const isNotFound = ref(false)
const loadError = ref('')
const isSubmitting = ref(false)
const fieldErrors = ref({})
const formError = ref('')

function clearSubmitErrors() {
  fieldErrors.value = {}
  formError.value = ''
}

async function loadBook() {
  book.value = null
  isNotFound.value = false
  loadError.value = ''

  if (!bookId.value) {
    latestRequest.cancel()
    isLoading.value = false
    isNotFound.value = true
    return
  }

  const request = latestRequest.begin()
  isLoading.value = true

  try {
    const result = await getBook(bookId.value, { signal: request.signal })

    if (request.isLatest()) {
      book.value = result
    }
  } catch (error) {
    if (request.isLatest() && !isRequestCanceled(error)) {
      if (getHttpStatus(error) === 404) {
        isNotFound.value = true
      } else {
        loadError.value = 'Не удалось загрузить книгу. Попробуйте ещё раз.'
      }
    }
  } finally {
    if (request.isLatest()) {
      isLoading.value = false
    }
  }
}

function setSubmitError(error) {
  const status = getHttpStatus(error)

  if (status === 422) {
    const validation = mapBookValidationErrors(error)
    fieldErrors.value = validation.fieldErrors
    formError.value = validation.formError
    return
  }

  if (status === 403) {
    formError.value = 'Недостаточно прав для изменения книги.'
    return
  }

  if (status === 404) {
    book.value = null
    isNotFound.value = true
    return
  }

  if (status !== 401) {
    formError.value = 'Не удалось сохранить книгу. Попробуйте ещё раз.'
  }
}

async function submitBook(payload) {
  if (isSubmitting.value || !bookId.value) {
    return
  }

  clearSubmitErrors()
  isSubmitting.value = true

  try {
    if (payload.cover) {
      await replaceBook(bookId.value, payload)
    } else {
      await patchBook(bookId.value, payload)
    }

    await router.push({ name: 'book-details', params: { id: bookId.value } })
  } catch (error) {
    setSubmitError(error)
  } finally {
    isSubmitting.value = false
  }
}

watch(() => route.params.id, loadBook, { immediate: true })
</script>

<template>
  <section>
    <LoadingState v-if="isLoading" message="Загружаем книгу…" />

    <div v-else-if="isNotFound" class="py-4">
      <h1 class="h2">Книга не найдена</h1>
      <p class="text-body-secondary">Возможно, книга была удалена или ссылка устарела.</p>
      <RouterLink class="btn btn-outline-primary" :to="{ name: 'books' }"> К каталогу </RouterLink>
    </div>

    <template v-else-if="loadError">
      <h1 class="h2 mb-4">Редактирование книги</h1>
      <ErrorAlert :message="loadError" @retry="loadBook" />
    </template>

    <template v-else-if="book">
      <h1 class="h2 mb-4">Редактирование книги</h1>
      <BookForm
        submit-label="Сохранить"
        :initial-book="book"
        :cancel-to="{ name: 'book-details', params: { id: bookId } }"
        :is-submitting="isSubmitting"
        :field-errors="fieldErrors"
        :form-error="formError"
        @change="clearSubmitErrors"
        @submit="submitBook"
      />
    </template>
  </section>
</template>
