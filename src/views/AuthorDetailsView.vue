<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { deleteAuthor, getAuthor } from '../api/authors.api'
import { getHttpStatus, isRequestCanceled } from '../api/errors'
import ConfirmDialog from '../components/common/ConfirmDialog.vue'
import EmptyState from '../components/common/EmptyState.vue'
import ErrorAlert from '../components/common/ErrorAlert.vue'
import LoadingState from '../components/common/LoadingState.vue'
import { useLatestRequest } from '../composables/useLatestRequest'
import { parsePositiveInteger } from '../router/publicQuery'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const latestRequest = useLatestRequest()
const authorId = computed(() => parsePositiveInteger(route.params.id))

const author = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')
const isNotFound = ref(false)
const isDeleteDialogOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')

async function loadAuthor() {
  author.value = null
  errorMessage.value = ''
  isNotFound.value = false

  if (!authorId.value) {
    latestRequest.cancel()
    isLoading.value = false
    isNotFound.value = true
    return
  }

  const request = latestRequest.begin()
  isLoading.value = true

  try {
    const response = await getAuthor(authorId.value, { signal: request.signal })

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

function openDeleteDialog() {
  deleteError.value = ''
  isDeleteDialogOpen.value = true
}

function closeDeleteDialog() {
  if (!isDeleting.value) {
    isDeleteDialogOpen.value = false
    deleteError.value = ''
  }
}

async function confirmDelete() {
  if (isDeleting.value || !authorId.value) {
    return
  }

  deleteError.value = ''
  isDeleting.value = true

  try {
    await deleteAuthor(authorId.value)
    isDeleteDialogOpen.value = false
    await router.push({ name: 'authors' })
  } catch (error) {
    const status = getHttpStatus(error)

    if (status === 403) {
      deleteError.value = 'Недостаточно прав для удаления автора.'
    } else if (status === 404) {
      deleteError.value = 'Автор уже удалён или не найден.'
    } else if (status !== 401) {
      deleteError.value = 'Не удалось удалить автора. Попробуйте ещё раз.'
    }
  } finally {
    isDeleting.value = false
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
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <h1 id="author-title" class="display-6 fw-bold mb-0">
        {{ author.full_name || 'Имя автора не указано' }}
      </h1>
      <div v-if="authStore.isAuthenticated && authorId" class="d-flex flex-wrap gap-2">
        <RouterLink
          class="btn btn-outline-primary"
          :to="{ name: 'author-edit', params: { id: authorId } }"
        >
          Редактировать
        </RouterLink>
        <button class="btn btn-outline-danger" type="button" @click="openDeleteDialog">
          Удалить
        </button>
      </div>
    </div>

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

    <ConfirmDialog
      :is-open="isDeleteDialogOpen"
      title="Удалить автора?"
      :message="`Автор «${author.full_name || 'Без имени'}» будет удалён. Это действие нельзя отменить.`"
      confirm-label="Удалить"
      :is-processing="isDeleting"
      :error-message="deleteError"
      @cancel="closeDeleteDialog"
      @confirm="confirmDelete"
    />
  </article>
</template>
