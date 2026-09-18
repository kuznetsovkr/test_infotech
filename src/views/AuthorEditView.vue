<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getAuthor, updateAuthor } from '../api/authors.api'
import { getApiErrorItems, getHttpStatus, isRequestCanceled } from '../api/errors'
import AuthorForm from '../components/authors/AuthorForm.vue'
import ErrorAlert from '../components/common/ErrorAlert.vue'
import LoadingState from '../components/common/LoadingState.vue'
import { useLatestRequest } from '../composables/useLatestRequest'
import { parsePositiveInteger } from '../router/publicQuery'

const route = useRoute()
const router = useRouter()
const latestRequest = useLatestRequest()
const authorId = computed(() => parsePositiveInteger(route.params.id))

const author = ref(null)
const isLoading = ref(true)
const isNotFound = ref(false)
const loadError = ref('')
const isSubmitting = ref(false)
const fieldError = ref('')
const formError = ref('')

function clearSubmitErrors() {
  fieldError.value = ''
  formError.value = ''
}

async function loadAuthor() {
  author.value = null
  isNotFound.value = false
  loadError.value = ''

  if (!authorId.value) {
    isLoading.value = false
    isNotFound.value = true
    return
  }

  isLoading.value = true
  const request = latestRequest.begin()

  try {
    const result = await getAuthor(authorId.value, { signal: request.signal })

    if (request.isLatest()) {
      author.value = result
    }
  } catch (error) {
    if (request.isLatest() && !isRequestCanceled(error)) {
      if (getHttpStatus(error) === 404) {
        isNotFound.value = true
      } else {
        loadError.value = 'Не удалось загрузить автора. Попробуйте ещё раз.'
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
    const errors = getApiErrorItems(error)
    const fullNameError = errors.find((item) => item.field === 'full_name')
    const generalError = errors.find((item) => item.field !== 'full_name')

    fieldError.value = fullNameError?.message ?? ''
    formError.value = generalError?.message ?? (fullNameError ? '' : 'Проверьте введённые данные.')
    return
  }

  if (status === 403) {
    formError.value = 'Недостаточно прав для изменения автора.'
    return
  }

  if (status === 404) {
    author.value = null
    isNotFound.value = true
    return
  }

  if (status !== 401) {
    formError.value = 'Не удалось сохранить автора. Попробуйте ещё раз.'
  }
}

async function submitAuthor(payload) {
  if (isSubmitting.value) {
    return
  }

  if (!authorId.value) {
    isNotFound.value = true
    return
  }

  clearSubmitErrors()
  isSubmitting.value = true

  try {
    await updateAuthor(authorId.value, payload)
    await router.push({ name: 'author-details', params: { id: authorId.value } })
  } catch (error) {
    setSubmitError(error)
  } finally {
    isSubmitting.value = false
  }
}

watch(() => route.params.id, loadAuthor, { immediate: true })
</script>

<template>
  <section class="mx-auto" style="max-width: 42rem">
    <LoadingState v-if="isLoading" message="Загружаем автора…" />

    <div v-else-if="isNotFound" class="py-4">
      <h1 class="h2">Автор не найден</h1>
      <p class="text-secondary">Возможно, автор был удалён или ссылка устарела.</p>
      <RouterLink class="btn btn-outline-primary" :to="{ name: 'authors' }">
        К списку авторов
      </RouterLink>
    </div>

    <template v-else-if="loadError">
      <h1 class="h2 mb-4">Редактирование автора</h1>
      <ErrorAlert :message="loadError" @retry="loadAuthor" />
    </template>

    <template v-else-if="author">
      <h1 class="h2 mb-4">Редактирование автора</h1>
      <AuthorForm
        submit-label="Сохранить"
        :initial-full-name="author.full_name ?? ''"
        :cancel-to="{ name: 'author-details', params: { id: authorId } }"
        :is-submitting="isSubmitting"
        :field-error="fieldError"
        :form-error="formError"
        @change="clearSubmitErrors"
        @submit="submitAuthor"
      />
    </template>
  </section>
</template>
