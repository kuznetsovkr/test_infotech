<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import BookAuthorSelector from './BookAuthorSelector.vue'
import BookCoverInput from './BookCoverInput.vue'

const props = defineProps({
  initialBook: {
    type: Object,
    default: () => ({}),
  },
  requireCover: {
    type: Boolean,
    default: false,
  },
  isSubmitting: {
    type: Boolean,
    default: false,
  },
  fieldErrors: {
    type: Object,
    default: () => ({}),
  },
  formError: {
    type: String,
    default: '',
  },
  submitLabel: {
    type: String,
    required: true,
  },
  cancelTo: {
    type: [String, Object],
    required: true,
  },
})

const emit = defineEmits(['submit', 'change'])

const formElement = ref(null)
const title = ref(props.initialBook.title ?? '')
const year = ref(Number.isInteger(props.initialBook.year) ? String(props.initialBook.year) : '')
const description = ref(props.initialBook.description ?? '')
const isbn = ref(props.initialBook.isbn ?? '')
const selectedAuthors = ref(
  Array.isArray(props.initialBook.authors) ? [...props.initialBook.authors] : [],
)
const coverFile = ref(null)
const clientErrors = reactive({})

function fieldError(field) {
  return clientErrors[field] || props.fieldErrors[field] || ''
}

function clearFieldError(field) {
  clientErrors[field] = ''
  emit('change', field)
}

function updateAuthors(authors) {
  selectedAuthors.value = authors
}

function updateCover(file) {
  coverFile.value = file
}

function setCoverValidationError(message) {
  coverFile.value = null
  clientErrors.cover = message
  emit('change', 'cover')
}

async function focusFirstInvalidControl() {
  await nextTick()
  formElement.value?.querySelector('[aria-invalid="true"]')?.focus()
}

function validate() {
  Object.keys(clientErrors).forEach((field) => {
    clientErrors[field] = ''
  })

  const normalizedTitle = title.value.trim()
  const rawYear = String(year.value).trim()
  const normalizedYear = Number(rawYear)
  const authorIds = [...new Set(selectedAuthors.value.map((author) => author?.id))].filter(
    Number.isInteger,
  )

  if (!normalizedTitle) {
    clientErrors.title = 'Укажите название книги.'
  }

  if (!rawYear) {
    clientErrors.year = 'Укажите год выпуска.'
  } else if (!Number.isInteger(normalizedYear)) {
    clientErrors.year = 'Год должен быть целым числом.'
  }

  if (authorIds.length === 0) {
    clientErrors.author_ids = 'Выберите хотя бы одного автора.'
  }

  if (coverFile.value && !coverFile.value.type.startsWith('image/')) {
    clientErrors.cover = 'Выберите файл изображения.'
  } else if (props.requireCover && !coverFile.value) {
    clientErrors.cover = 'Выберите обложку.'
  }

  if (Object.values(clientErrors).some(Boolean)) {
    return null
  }

  return {
    title: normalizedTitle,
    year: normalizedYear,
    description: description.value.trim(),
    isbn: isbn.value.trim(),
    author_ids: authorIds,
    cover: coverFile.value,
  }
}

async function handleSubmit() {
  if (props.isSubmitting) {
    return
  }

  const payload = validate()

  if (!payload) {
    await focusFirstInvalidControl()
    return
  }

  emit('submit', payload)
}

watch(
  () => props.fieldErrors,
  async (errors) => {
    if (Object.values(errors).some(Boolean)) {
      await focusFirstInvalidControl()
    }
  },
  { deep: true },
)
</script>

<template>
  <form ref="formElement" novalidate @submit.prevent="handleSubmit">
    <div v-if="formError" class="alert alert-danger" role="alert">
      {{ formError }}
    </div>

    <div class="row g-4">
      <div class="col-12 col-lg-7">
        <div class="mb-3">
          <label class="form-label" for="book-title">Название</label>
          <input
            id="book-title"
            v-model="title"
            class="form-control"
            :class="{ 'is-invalid': fieldError('title') }"
            type="text"
            required
            :disabled="isSubmitting"
            :aria-invalid="fieldError('title') ? 'true' : 'false'"
            :aria-describedby="fieldError('title') ? 'book-title-error' : undefined"
            @input="clearFieldError('title')"
          />
          <div v-if="fieldError('title')" id="book-title-error" class="invalid-feedback">
            {{ fieldError('title') }}
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label" for="book-release-year">Год выпуска</label>
          <input
            id="book-release-year"
            v-model="year"
            class="form-control"
            :class="{ 'is-invalid': fieldError('year') }"
            type="number"
            step="1"
            required
            :disabled="isSubmitting"
            :aria-invalid="fieldError('year') ? 'true' : 'false'"
            :aria-describedby="fieldError('year') ? 'book-year-error' : undefined"
            @input="clearFieldError('year')"
          />
          <div v-if="fieldError('year')" id="book-year-error" class="invalid-feedback">
            {{ fieldError('year') }}
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label" for="book-description">Описание</label>
          <textarea
            id="book-description"
            v-model="description"
            class="form-control"
            :class="{ 'is-invalid': fieldError('description') }"
            rows="6"
            :disabled="isSubmitting"
            :aria-invalid="fieldError('description') ? 'true' : 'false'"
            :aria-describedby="fieldError('description') ? 'book-description-error' : undefined"
            @input="clearFieldError('description')"
          ></textarea>
          <div
            v-if="fieldError('description')"
            id="book-description-error"
            class="invalid-feedback"
          >
            {{ fieldError('description') }}
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label" for="book-isbn">ISBN</label>
          <input
            id="book-isbn"
            v-model="isbn"
            class="form-control"
            :class="{ 'is-invalid': fieldError('isbn') }"
            type="text"
            :disabled="isSubmitting"
            :aria-invalid="fieldError('isbn') ? 'true' : 'false'"
            :aria-describedby="fieldError('isbn') ? 'book-isbn-error' : undefined"
            @input="clearFieldError('isbn')"
          />
          <div v-if="fieldError('isbn')" id="book-isbn-error" class="invalid-feedback">
            {{ fieldError('isbn') }}
          </div>
        </div>

        <BookAuthorSelector
          :model-value="selectedAuthors"
          :error="fieldError('author_ids')"
          :disabled="isSubmitting"
          @change="clearFieldError('author_ids')"
          @update:model-value="updateAuthors"
        />
      </div>

      <div class="col-12 col-lg-5">
        <BookCoverInput
          :model-value="coverFile"
          :existing-cover-url="initialBook.cover_url ?? ''"
          :title="title"
          :required="requireCover"
          :error="fieldError('cover')"
          :disabled="isSubmitting"
          @change="clearFieldError('cover')"
          @update:model-value="updateCover"
          @validation-error="setCoverValidationError"
        />
      </div>
    </div>

    <div class="d-flex flex-wrap gap-2 mt-4">
      <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
        <span
          v-if="isSubmitting"
          class="spinner-border spinner-border-sm me-2"
          aria-hidden="true"
        ></span>
        {{ isSubmitting ? 'Сохранение…' : submitLabel }}
      </button>
      <RouterLink class="btn btn-outline-secondary" :to="cancelTo">Отмена</RouterLink>
    </div>
  </form>
</template>
