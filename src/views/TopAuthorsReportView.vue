<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getTopAuthors } from '../api/reports.api'
import { getHttpStatus, isRequestCanceled } from '../api/errors'
import EmptyState from '../components/common/EmptyState.vue'
import ErrorAlert from '../components/common/ErrorAlert.vue'
import LoadingState from '../components/common/LoadingState.vue'
import { useLatestRequest } from '../composables/useLatestRequest'
import { parseOptionalInteger } from '../router/publicQuery'

const route = useRoute()
const router = useRouter()
const latestRequest = useLatestRequest()

const defaultYear = new Date().getFullYear()
const yearInput = ref(String(defaultYear))
const reportYear = ref(null)
const items = ref([])
const isLoading = ref(false)
const hasLoaded = ref(false)
const yearError = ref('')
const errorMessage = ref('')

const tableCaption = computed(() =>
  Number.isInteger(reportYear.value)
    ? `ТОП-10 авторов по количеству книг за ${reportYear.value} год`
    : 'ТОП-10 авторов по количеству книг за выбранный год',
)

function getSingleQueryValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function resetReportState() {
  latestRequest.cancel()
  items.value = []
  reportYear.value = null
  hasLoaded.value = false
  isLoading.value = false
  errorMessage.value = ''
}

async function loadReport(year) {
  const request = latestRequest.begin()
  isLoading.value = true
  hasLoaded.value = false
  items.value = []
  reportYear.value = null
  yearError.value = ''
  errorMessage.value = ''

  try {
    const response = await getTopAuthors(year, { signal: request.signal })

    if (request.isLatest()) {
      items.value = Array.isArray(response.items) ? response.items : []
      reportYear.value = Number.isInteger(response.year) ? response.year : year
      hasLoaded.value = true
    }
  } catch (error) {
    if (!request.isLatest() || isRequestCanceled(error)) {
      return
    }

    const status = getHttpStatus(error)

    if (status === 400) {
      yearError.value = 'Сервер не принял год. Проверьте введённое значение.'
    } else if (status !== 401) {
      errorMessage.value = 'Не удалось загрузить отчёт. Попробуйте ещё раз.'
    }
  } finally {
    if (request.isLatest()) {
      isLoading.value = false
    }
  }
}

async function submitYear() {
  const rawYear = String(yearInput.value).trim()

  if (!rawYear) {
    resetReportState()
    yearError.value = 'Укажите год.'
    return
  }

  const year = parseOptionalInteger(rawYear)

  if (year === null) {
    resetReportState()
    yearError.value = 'Год должен быть целым числом.'
    return
  }

  yearError.value = ''
  const routeYear = parseOptionalInteger(route.query.year)

  if (routeYear === year && String(getSingleQueryValue(route.query.year)) === String(year)) {
    await loadReport(year)
    return
  }

  await router.push({
    name: 'top-authors-report',
    query: { year: String(year) },
  })
}

async function retryReport() {
  const year = parseOptionalInteger(route.query.year)

  if (year !== null) {
    await loadReport(year)
  }
}

watch(
  () => route.query.year,
  async (queryYear) => {
    const rawQueryYear = getSingleQueryValue(queryYear)

    if (rawQueryYear === undefined || rawQueryYear === null || rawQueryYear === '') {
      yearInput.value = String(defaultYear)
      yearError.value = ''
      resetReportState()
      return
    }

    yearInput.value = String(rawQueryYear)
    const year = parseOptionalInteger(rawQueryYear)

    if (year === null) {
      resetReportState()
      yearError.value = 'Год в адресе должен быть целым числом.'
      return
    }

    await loadReport(year)
  },
  { immediate: true },
)
</script>

<template>
  <section aria-labelledby="top-authors-title">
    <div class="mb-4">
      <h1 id="top-authors-title" class="display-6 fw-bold mb-1">ТОП-10 авторов</h1>
      <p class="text-body-secondary mb-0">
        Авторы, выпустившие больше всего книг за выбранный год.
      </p>
    </div>

    <form
      class="row g-3 align-items-end border rounded bg-white p-3 mb-4"
      @submit.prevent="submitYear"
    >
      <div class="col-12 col-sm-7 col-md-5 col-lg-3">
        <label class="form-label" for="report-year">Год</label>
        <input
          id="report-year"
          v-model="yearInput"
          class="form-control"
          :class="{ 'is-invalid': yearError }"
          type="number"
          step="1"
          required
          :aria-invalid="yearError ? 'true' : 'false'"
          :aria-describedby="yearError ? 'report-year-error' : undefined"
        />
        <div v-if="yearError" id="report-year-error" class="invalid-feedback" role="alert">
          {{ yearError }}
        </div>
      </div>
      <div class="col-12 col-sm-auto">
        <button class="btn btn-primary w-100" type="submit" :disabled="isLoading">
          {{ isLoading ? 'Загрузка…' : 'Показать отчёт' }}
        </button>
      </div>
    </form>

    <LoadingState v-if="isLoading" message="Загрузка отчёта…" />
    <ErrorAlert
      v-else-if="errorMessage"
      :message="errorMessage"
      retry-label="Повторить загрузку"
      @retry="retryReport"
    />
    <EmptyState
      v-else-if="hasLoaded && items.length === 0"
      message="За выбранный год данные не найдены."
    />

    <div v-else-if="hasLoaded" class="table-responsive">
      <table class="table table-striped table-hover align-middle bg-white">
        <caption class="visually-hidden">
          {{
            tableCaption
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Место</th>
            <th scope="col">Автор</th>
            <th scope="col">Количество книг</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in items"
            :key="`${item.author_id ?? 'author'}-${item.rank ?? 'rank'}-${index}`"
          >
            <th scope="row">{{ Number.isInteger(item.rank) ? item.rank : '—' }}</th>
            <td>
              <RouterLink
                v-if="Number.isInteger(item.author_id) && item.author_id > 0"
                :to="{ name: 'author-details', params: { id: item.author_id } }"
              >
                {{ item.full_name || 'Имя автора не указано' }}
              </RouterLink>
              <span v-else>{{ item.full_name || 'Имя автора не указано' }}</span>
            </td>
            <td>{{ Number.isInteger(item.books_count) ? item.books_count : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="text-body-secondary">
      Выберите целый год и отправьте форму, чтобы построить отчёт.
    </p>
  </section>
</template>
