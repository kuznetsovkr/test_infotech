<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

import {
  getDemoSmsLog,
  normalizeDemoPhone,
  subscribeToDemoAuthor,
  subscribeToSmsLogUpdates,
} from '../../mocks/subscriptions'

const props = defineProps({
  authorId: {
    type: Number,
    required: true,
  },
  authorName: {
    type: String,
    default: '',
  },
})

const phoneInput = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isSubmitting = ref(false)
const notificationEvents = ref([])
let stopLogUpdates = () => {}

function loadNotificationEvents() {
  notificationEvents.value = getDemoSmsLog({ authorId: props.authorId }).slice(0, 5)
}

function clearMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

async function submitSubscription() {
  if (isSubmitting.value) {
    return
  }

  clearMessages()
  const normalizedPhone = normalizeDemoPhone(phoneInput.value)

  if (!normalizedPhone) {
    errorMessage.value = 'Введите номер из 10–15 цифр в международном формате.'
    return
  }

  isSubmitting.value = true

  try {
    await Promise.resolve()
    const result = subscribeToDemoAuthor({
      authorId: props.authorId,
      phone: normalizedPhone,
    })

    if (result.error) {
      errorMessage.value = result.error
      return
    }

    phoneInput.value = normalizedPhone
    successMessage.value = result.created
      ? 'Демонстрационная подписка сохранена.'
      : 'Этот номер уже подписан на новые книги автора.'
  } finally {
    isSubmitting.value = false
  }
}

function formatTimestamp(value) {
  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(timestamp)
}

onMounted(() => {
  loadNotificationEvents()
  stopLogUpdates = subscribeToSmsLogUpdates(loadNotificationEvents)
})

onBeforeUnmount(() => {
  stopLogUpdates()
})
</script>

<template>
  <aside
    class="card border-info-subtle bg-info-subtle mb-4"
    aria-labelledby="demo-subscription-title"
  >
    <div class="card-body">
      <p class="badge text-bg-info mb-2">Bonus / demo</p>
      <h2 id="demo-subscription-title" class="h4">Демонстрационная подписка</h2>
      <p class="text-body-secondary">
        Подпишитесь на тестовое уведомление о новой книге автора
        {{ authorName || `ID ${authorId}` }}.
      </p>

      <form class="row g-2 align-items-start" novalidate @submit.prevent="submitSubscription">
        <div class="col-12 col-md">
          <label class="form-label" for="demo-subscription-phone">Номер телефона</label>
          <input
            id="demo-subscription-phone"
            v-model="phoneInput"
            class="form-control"
            :class="{ 'is-invalid': errorMessage }"
            type="tel"
            autocomplete="tel"
            placeholder="+7 999 123-45-67"
            required
            :disabled="isSubmitting"
            :aria-invalid="errorMessage ? 'true' : 'false'"
            :aria-describedby="
              errorMessage ? 'demo-subscription-phone-error' : 'demo-subscription-phone-help'
            "
            @input="clearMessages"
          />
          <div
            v-if="errorMessage"
            id="demo-subscription-phone-error"
            class="invalid-feedback"
            role="alert"
          >
            {{ errorMessage }}
          </div>
          <div id="demo-subscription-phone-help" class="form-text">
            Только demo storage; реальная SMS оператору не отправляется.
          </div>
        </div>
        <div class="col-12 col-md-auto pt-md-4">
          <button class="btn btn-info w-100" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? 'Сохранение…' : 'Подписаться' }}
          </button>
        </div>
      </form>

      <div v-if="successMessage" class="alert alert-success mt-3 mb-0" role="status">
        {{ successMessage }}
      </div>

      <section class="mt-4" aria-labelledby="demo-sms-log-title">
        <h3 id="demo-sms-log-title" class="h5">Последние тестовые уведомления</h3>
        <p v-if="notificationEvents.length === 0" class="text-body-secondary small mb-0">
          Уведомлений для этого автора пока нет.
        </p>
        <ul v-else class="list-group" data-testid="demo-sms-log">
          <li
            v-for="event in notificationEvents"
            :key="`${event.timestamp}-${event.book_id}-${event.phone}`"
            class="list-group-item"
          >
            <div class="d-flex flex-wrap justify-content-between gap-2">
              <strong>{{ event.book_title }}</strong>
              <span :class="event.success ? 'text-success' : 'text-danger'">
                {{ event.success ? 'Emulator: успешно' : 'Emulator: ошибка' }}
              </span>
            </div>
            <div class="small text-body-secondary">
              {{ event.phone_masked }} · {{ event.author_names.join(', ') }} ·
              {{ formatTimestamp(event.timestamp) }}
              <span v-if="event.server_id"> · server_id {{ event.server_id }}</span>
            </div>
            <p v-if="!event.success && event.error" class="small text-danger mb-0">
              {{ event.error }}
            </p>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>
