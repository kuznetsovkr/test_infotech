<script setup>
import { computed } from 'vue'

import { useAuthorSearch } from '../../composables/useAuthorSearch'
import AppPagination from '../common/AppPagination.vue'
import LoadingState from '../common/LoadingState.vue'

const AUTHORS_PER_PAGE = 10

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  error: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'change'])
const { hasSearched, isSearching, pagination, results, searchAuthors, searchError, searchInput } =
  useAuthorSearch({ pageSize: AUTHORS_PER_PAGE })

const selectedAuthors = computed(() =>
  props.modelValue.filter((author) => Number.isInteger(author?.id)),
)
const selectedIds = computed(() => new Set(selectedAuthors.value.map((author) => author.id)))

async function runAuthorSearch(page = 1) {
  if (props.disabled) {
    return
  }

  await searchAuthors(page)
}

function selectAuthor(author) {
  if (props.disabled || !Number.isInteger(author?.id) || selectedIds.value.has(author.id)) {
    return
  }

  emit('update:modelValue', [...selectedAuthors.value, author])
  emit('change')
}

function removeAuthor(authorId) {
  if (props.disabled) {
    return
  }

  emit(
    'update:modelValue',
    selectedAuthors.value.filter((author) => author.id !== authorId),
  )
  emit('change')
}
</script>

<template>
  <fieldset class="border rounded p-3">
    <legend class="float-none w-auto px-1 fs-6 fw-semibold">Авторы</legend>

    <ul v-if="selectedAuthors.length" class="list-unstyled d-flex flex-wrap gap-2 mb-3">
      <li v-for="author in selectedAuthors" :key="author.id">
        <span
          class="book-author-chip badge text-bg-primary d-inline-flex align-items-center gap-2 p-2 fs-6 fw-normal"
        >
          {{ author.full_name || `Автор ID ${author.id}` }}
          <button
            class="btn-close btn-close-white"
            type="button"
            :disabled="disabled"
            :aria-label="`Удалить автора ${author.full_name || author.id}`"
            @click="removeAuthor(author.id)"
          ></button>
        </span>
      </li>
    </ul>
    <p v-else class="text-body-secondary small">Авторы пока не выбраны.</p>

    <div class="row g-2 align-items-end">
      <div class="col-12 col-md">
        <label class="form-label" for="book-author-search">Поиск автора</label>
        <input
          id="book-author-search"
          v-model="searchInput"
          class="form-control"
          :class="{ 'is-invalid': error }"
          type="search"
          autocomplete="off"
          :disabled="disabled"
          :aria-invalid="error ? 'true' : 'false'"
          :aria-describedby="error ? 'book-authors-error' : 'book-author-search-help'"
          @keydown.enter.prevent="runAuthorSearch(1)"
        />
        <div v-if="error" id="book-authors-error" class="invalid-feedback">
          {{ error }}
        </div>
      </div>
      <div class="col-12 col-md-auto">
        <button
          class="btn btn-outline-primary w-100"
          type="button"
          :disabled="disabled || isSearching"
          @click="runAuthorSearch(1)"
        >
          Найти
        </button>
      </div>
    </div>
    <p id="book-author-search-help" class="form-text mb-0">
      Поиск выполняется постранично через Authors API.
    </p>

    <LoadingState v-if="isSearching" message="Загрузка авторов…" />

    <div v-else-if="searchError" class="alert alert-danger mt-3 mb-0" role="alert">
      <p class="mb-2">{{ searchError }}</p>
      <button
        class="btn btn-outline-danger btn-sm"
        type="button"
        :disabled="disabled"
        @click="runAuthorSearch(pagination.page)"
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
            :disabled="disabled || !Number.isInteger(author.id) || selectedIds.has(author.id)"
            @click="selectAuthor(author)"
          >
            {{ author.full_name || 'Имя автора не указано' }}
            <span v-if="selectedIds.has(author.id)" class="text-body-secondary"> — добавлен</span>
          </button>
        </li>
      </ul>
      <p v-else class="text-body-secondary mt-3 mb-0">Авторы не найдены.</p>

      <AppPagination
        v-if="!disabled"
        :current-page="pagination.page"
        :total-pages="pagination.totalPages"
        label="Страницы результатов поиска авторов для книги"
        @change="runAuthorSearch"
      />
    </template>
  </fieldset>
</template>
