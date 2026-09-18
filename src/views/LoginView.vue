<script setup>
import { nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { resolvePostLoginRedirect } from '../router/redirect'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const username = ref('')
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const errorAlert = ref(null)

function getBackendMessage(error) {
  const errors = error?.response?.data?.errors

  if (!Array.isArray(errors)) {
    return null
  }

  const errorWithMessage = errors.find((item) => typeof item?.message === 'string')
  return errorWithMessage?.message ?? null
}

function getLoginErrorMessage(error) {
  const status = error?.response?.status

  if (status === 401) {
    return 'Неверное имя пользователя или пароль.'
  }

  if (error?.code === 'ERR_INVALID_AUTH_RESPONSE') {
    return 'Сервис авторизации вернул некорректный ответ.'
  }

  if (!error?.response) {
    return 'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.'
  }

  if (status >= 500) {
    return 'Сервис авторизации временно недоступен. Повторите попытку позже.'
  }

  return getBackendMessage(error) ?? 'Не удалось выполнить вход. Повторите попытку.'
}

async function handleSubmit() {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await authStore.login({
      username: username.value.trim(),
      password: password.value,
    })

    password.value = ''
    await router.replace(resolvePostLoginRedirect(router, route.query.redirect))
  } catch (error) {
    errorMessage.value = getLoginErrorMessage(error)
    await nextTick()
    errorAlert.value?.focus()
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto login-view" aria-labelledby="login-title">
    <div class="card border-0 shadow-sm">
      <div class="card-body p-4 p-md-5">
        <h1 id="login-title" class="h2 mb-4">Вход</h1>

        <div
          v-if="errorMessage"
          ref="errorAlert"
          class="alert alert-danger"
          role="alert"
          tabindex="-1"
        >
          {{ errorMessage }}
        </div>

        <form :aria-busy="isSubmitting" @submit.prevent="handleSubmit">
          <div class="mb-3">
            <label class="form-label" for="username">Имя пользователя</label>
            <input
              id="username"
              v-model="username"
              class="form-control"
              name="username"
              type="text"
              autocomplete="username"
              required
            />
          </div>

          <div class="mb-4">
            <label class="form-label" for="password">Пароль</label>
            <input
              id="password"
              v-model="password"
              class="form-control"
              name="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <button class="btn btn-primary w-100" type="submit" :disabled="isSubmitting">
            <span
              v-if="isSubmitting"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            {{ isSubmitting ? 'Выполняется вход…' : 'Войти' }}
          </button>
        </form>
      </div>
    </div>
  </section>
</template>
