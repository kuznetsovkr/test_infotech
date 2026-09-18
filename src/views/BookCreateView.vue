<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { createBook } from '../api/books.api'
import { mapBookValidationErrors } from '../api/bookErrors'
import { getHttpStatus } from '../api/errors'
import BookForm from '../components/books/BookForm.vue'

const router = useRouter()
const isSubmitting = ref(false)
const fieldErrors = ref({})
const formError = ref('')

function clearErrors() {
  fieldErrors.value = {}
  formError.value = ''
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
    formError.value = 'Недостаточно прав для создания книги.'
    return
  }

  if (status !== 401) {
    formError.value = 'Не удалось создать книгу. Попробуйте ещё раз.'
  }
}

async function submitBook(payload) {
  if (isSubmitting.value) {
    return
  }

  clearErrors()
  isSubmitting.value = true

  try {
    const book = await createBook(payload)
    const bookId = Number(book?.id)

    if (Number.isInteger(bookId) && bookId > 0) {
      await router.push({ name: 'book-details', params: { id: bookId } })
    } else {
      await router.push({ name: 'books' })
    }
  } catch (error) {
    setSubmitError(error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section>
    <h1 class="h2 mb-4">Новая книга</h1>
    <BookForm
      require-cover
      submit-label="Создать книгу"
      :cancel-to="{ name: 'books' }"
      :is-submitting="isSubmitting"
      :field-errors="fieldErrors"
      :form-error="formError"
      @change="clearErrors"
      @submit="submitBook"
    />
  </section>
</template>
