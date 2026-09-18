<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  initialFullName: {
    type: String,
    default: '',
  },
  isSubmitting: {
    type: Boolean,
    default: false,
  },
  fieldError: {
    type: String,
    default: '',
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

const fullName = ref(props.initialFullName)
const clientError = ref('')
const fullNameInput = ref(null)

const visibleFieldError = computed(() => clientError.value || props.fieldError)

watch(
  () => props.initialFullName,
  (value) => {
    fullName.value = value
  },
)

watch(
  () => props.fieldError,
  async (value) => {
    if (value) {
      await nextTick()
      fullNameInput.value?.focus()
    }
  },
)

function handleInput() {
  clientError.value = ''
  emit('change')
}

async function handleSubmit() {
  if (props.isSubmitting) {
    return
  }

  const normalizedFullName = fullName.value.trim()

  if (!normalizedFullName) {
    clientError.value = 'Укажите ФИО автора.'
    await nextTick()
    fullNameInput.value?.focus()
    return
  }

  emit('submit', { full_name: normalizedFullName })
}
</script>

<template>
  <form class="author-form" novalidate @submit.prevent="handleSubmit">
    <div v-if="formError" class="alert alert-danger" role="alert">
      {{ formError }}
    </div>

    <div class="mb-4">
      <label class="form-label" for="author-full-name">ФИО</label>
      <input
        id="author-full-name"
        ref="fullNameInput"
        v-model="fullName"
        class="form-control"
        :class="{ 'is-invalid': visibleFieldError }"
        type="text"
        autocomplete="name"
        required
        :disabled="isSubmitting"
        :aria-invalid="visibleFieldError ? 'true' : 'false'"
        :aria-describedby="visibleFieldError ? 'author-full-name-error' : undefined"
        @input="handleInput"
      />
      <div v-if="visibleFieldError" id="author-full-name-error" class="invalid-feedback">
        {{ visibleFieldError }}
      </div>
    </div>

    <div class="d-flex flex-wrap gap-2">
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
