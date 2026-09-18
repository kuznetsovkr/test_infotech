<script setup>
const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
  },
  label: {
    type: String,
    default: 'Навигация по страницам',
  },
  totalPages: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['change'])

function goToPage(page) {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('change', page)
  }
}
</script>

<template>
  <nav v-if="totalPages > 1" class="mt-4" :aria-label="label">
    <ul class="pagination justify-content-center flex-wrap mb-0">
      <li class="page-item" :class="{ disabled: currentPage <= 1 }">
        <button
          class="page-link"
          type="button"
          :disabled="currentPage <= 1"
          aria-label="Предыдущая страница"
          @click="goToPage(currentPage - 1)"
        >
          Назад
        </button>
      </li>
      <li class="page-item disabled">
        <span class="page-link text-body" aria-current="page">
          Страница {{ currentPage }} из {{ totalPages }}
        </span>
      </li>
      <li class="page-item" :class="{ disabled: currentPage >= totalPages }">
        <button
          class="page-link"
          type="button"
          :disabled="currentPage >= totalPages"
          aria-label="Следующая страница"
          @click="goToPage(currentPage + 1)"
        >
          Вперёд
        </button>
      </li>
    </ul>
  </nav>
</template>
