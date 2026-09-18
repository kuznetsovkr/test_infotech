<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

import BookCover from './BookCover.vue'

const props = defineProps({
  modelValue: {
    type: [File, null],
    default: null,
  },
  existingCoverUrl: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
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

const emit = defineEmits(['update:modelValue', 'change', 'validation-error'])
const previewUrl = ref('')
const selectedFilename = ref('')

function releasePreviewUrl() {
  if (previewUrl.value && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(previewUrl.value)
  }

  previewUrl.value = ''
}

function handleFileChange(event) {
  releasePreviewUrl()

  const file = event.target.files?.[0] ?? null
  selectedFilename.value = file?.name ?? ''

  if (!file) {
    emit('update:modelValue', null)
    emit('change')
    return
  }

  if (!file.type.startsWith('image/')) {
    selectedFilename.value = ''
    event.target.value = ''
    emit('update:modelValue', null)
    emit('validation-error', 'Выберите файл изображения.')
    return
  }

  if (typeof URL.createObjectURL === 'function') {
    try {
      previewUrl.value = URL.createObjectURL(file)
    } catch {
      previewUrl.value = ''
    }
  }

  emit('update:modelValue', file)
  emit('change')
}

watch(
  () => props.modelValue,
  (file) => {
    if (!file) {
      releasePreviewUrl()
      selectedFilename.value = ''
    }
  },
)

onBeforeUnmount(releasePreviewUrl)
</script>

<template>
  <div>
    <label class="form-label" for="book-cover">
      Обложка <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>
    <input
      id="book-cover"
      class="form-control"
      :class="{ 'is-invalid': error }"
      type="file"
      accept="image/*"
      :required="required"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : 'false'"
      :aria-describedby="error ? 'book-cover-error' : 'book-cover-help'"
      @change="handleFileChange"
    />
    <div v-if="error" id="book-cover-error" class="invalid-feedback">
      {{ error }}
    </div>
    <p id="book-cover-help" class="form-text">
      Допустим файл изображения. Ограничения размера определяются backend.
    </p>

    <div v-if="previewUrl" class="book-cover-preview">
      <img
        class="book-cover"
        :src="previewUrl"
        :alt="title ? `Предпросмотр новой обложки книги «${title}»` : 'Предпросмотр новой обложки'"
      />
    </div>
    <div v-else-if="existingCoverUrl" class="book-cover-preview">
      <p class="small text-body-secondary mb-2">Текущая обложка</p>
      <BookCover :src="existingCoverUrl" :title="title" />
    </div>
    <p v-else-if="selectedFilename" class="small text-body-secondary mb-0">
      Выбран файл: {{ selectedFilename }}
    </p>
  </div>
</template>
