<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
})

const failed = ref(false)

watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <img
    v-if="src && !failed"
    class="book-cover"
    :src="src"
    :alt="title ? `Обложка книги «${title}»` : 'Обложка книги'"
    loading="lazy"
    @error="failed = true"
  />
  <div
    v-else
    class="book-cover book-cover-fallback d-flex align-items-center justify-content-center text-center"
    role="img"
    :aria-label="title ? `Обложка книги «${title}» отсутствует` : 'Обложка отсутствует'"
  >
    <span>Нет обложки</span>
  </div>
</template>
