<script setup>
import { ref, watch } from 'vue'

import { getAuthor } from '../../api/authors.api'
import { isRequestCanceled } from '../../api/errors'
import { useAuthorSearch } from '../../composables/useAuthorSearch'
import { useLatestRequest } from '../../composables/useLatestRequest'
import AppPagination from '../common/AppPagination.vue'
import LoadingState from '../common/LoadingState.vue'

const AUTHOR_SEARCH_PAGE_SIZE = 10

const props = defineProps({
  modelValue: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const {
  hasSearched,
  isSearching,
  pagination,
  resetSearchResults,
  results,
  searchAuthors,
  searchError,
  searchInput,
} = useAuthorSearch({ pageSize: AUTHOR_SEARCH_PAGE_SIZE })
const selectedAuthor = ref(null)
const selectedAuthorError = ref('')

const selectedAuthorRequest = useLatestRequest()

watch(
  () => props.modelValue,
  async (authorId) => {
    selectedAuthorError.value = ''

    if (!authorId) {
      selectedAuthorRequest.cancel()
      selectedAuthor.value = null
      return
    }

    if (selectedAuthor.value?.id === authorId) {
      return
    }

    const request = selectedAuthorRequest.begin()

    try {
      const author = await getAuthor(authorId, { signal: request.signal })

      if (request.isLatest()) {
        selectedAuthor.value = author
      }
    } catch (error) {
      if (request.isLatest() && !isRequestCanceled(error)) {
        selectedAuthor.value = null
        selectedAuthorError.value = 'Не удалось загрузить имя выбранного автора.'
      }
    }
  },
  { immediate: true },
)

function selectAuthor(author) {
  if (!Number.isInteger(author.id)) {
    return
  }

  selectedAuthor.value = author
  selectedAuthorError.value = ''
  resetSearchResults()
  emit('update:modelValue', author.id)
}

function clearAuthor() {
  selectedAuthorRequest.cancel()
  selectedAuthor.value = null
  selectedAuthorError.value = ''
  emit('update:modelValue', null)
}
</script>

<template>
  <section class="border rounded bg-white p-3" aria-labelledby="author-filter-title">
    <h2 id="author-filter-title" class="h6 mb-3">Фильтр по автору</h2>

    <div v-if="modelValue" class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <span class="badge text-bg-primary fs-6 fw-normal">
        {{ selectedAuthor?.full_name || `Автор ID ${modelValue}` }}
      </span>
      <button class="btn btn-sm btn-outline-secondary" type="button" @click="clearAuthor">
        Сбросить автора
      </button>
    </div>

    <p v-if="selectedAuthorError" class="small text-danger" role="alert">
      {{ selectedAuthorError }}
    </p>

    <form class="row g-2 align-items-end" @submit.prevent="searchAuthors(1)">
      <div class="col-12 col-md">
        <label class="form-label" for="author-filter-search">Поиск автора</label>
        <input
          id="author-filter-search"
          v-model="searchInput"
          class="form-control"
          type="search"
          autocomplete="off"
          placeholder="Введите ФИО или оставьте поле пустым"
        />
      </div>
      <div class="col-12 col-md-auto">
        <button class="btn btn-outline-primary w-100" type="submit" :disabled="isSearching">
          Найти автора
        </button>
      </div>
    </form>

    <p class="form-text mb-0">Результаты загружаются постранично из публичного Authors API.</p>

    <LoadingState v-if="isSearching" message="Загрузка авторов…" />

    <div v-else-if="searchError" class="alert alert-danger mt-3 mb-0" role="alert">
      <p class="mb-2">{{ searchError }}</p>
      <button
        class="btn btn-outline-danger btn-sm"
        type="button"
        @click="searchAuthors(pagination.page)"
      >
        Повторить
      </button>
    </div>

    <template v-else-if="hasSearched">
      <ul v-if="results.length" class="list-group mt-3" aria-label="Результаты поиска авторов">
        <li
          v-for="author in results"
          :key="author.id ?? author.full_name"
          class="list-group-item p-0"
        >
          <button
            class="btn w-100 text-start rounded-0 py-3"
            type="button"
            :disabled="!Number.isInteger(author.id)"
            @click="selectAuthor(author)"
          >
            {{ author.full_name || 'Имя автора не указано' }}
          </button>
        </li>
      </ul>
      <p v-else class="text-body-secondary mt-3 mb-0">Авторы не найдены.</p>

      <AppPagination
        :current-page="pagination.page"
        :total-pages="pagination.totalPages"
        label="Страницы результатов поиска авторов"
        @change="searchAuthors"
      />
    </template>
  </section>
</template>
