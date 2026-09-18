<script setup>
defineProps({
  message: {
    type: String,
    default: 'Загрузка…',
  },
})
</script>

<template>
  <div class="d-flex align-items-center justify-content-center gap-3 py-5" role="status">
    <span class="spinner-border text-primary" aria-hidden="true"></span>
    <span>{{ message }}</span>
  </div>
</template>
