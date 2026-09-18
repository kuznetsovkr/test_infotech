<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { createAuthor } from '../api/authors.api'
import { getApiErrorItems, getHttpStatus } from '../api/errors'
import AuthorForm from '../components/authors/AuthorForm.vue'

const router = useRouter()
const isSubmitting = ref(false)
const fieldError = ref('')
const formError = ref('')

function clearErrors() {
  fieldError.value = ''
  formError.value = ''
}

function setSubmitError(error) {
  const status = getHttpStatus(error)

  if (status === 422) {
    const errors = getApiErrorItems(error)
    const fullNameError = errors.find((item) => item.field === 'full_name')
    const generalError = errors.find((item) => item.field !== 'full_name')

    fieldError.value = fullNameError?.message ?? ''
    formError.value = generalError?.message ?? (fullNameError ? '' : 'Проверьте введённые данные.')
    return
  }

  if (status === 403) {
    formError.value = 'Недостаточно прав для создания автора.'
    return
  }

  if (status !== 401) {
    formError.value = 'Не удалось создать автора. Попробуйте ещё раз.'
  }
}

async function submitAuthor(payload) {
  if (isSubmitting.value) {
    return
  }

  clearErrors()
  isSubmitting.value = true

  try {
    const author = await createAuthor(payload)
    const authorId = Number(author?.id)

    if (Number.isInteger(authorId) && authorId > 0) {
      await router.push({ name: 'author-details', params: { id: authorId } })
    } else {
      await router.push({ name: 'authors' })
    }
  } catch (error) {
    setSubmitError(error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto" style="max-width: 42rem">
    <h1 class="h2 mb-4">Новый автор</h1>
    <AuthorForm
      submit-label="Создать автора"
      :cancel-to="{ name: 'authors' }"
      :is-submitting="isSubmitting"
      :field-error="fieldError"
      :form-error="formError"
      @change="clearErrors"
      @submit="submitAuthor"
    />
  </section>
</template>
