<script setup>
defineProps({
  message: {
    type: String,
    required: true,
  },
  retryLabel: {
    type: String,
    default: 'Повторить',
  },
  showRetry: {
    type: Boolean,
    default: true,
  },
})

defineEmits(['retry'])
</script>

<template>
  <div class="alert alert-danger" role="alert">
    <p class="mb-0">{{ message }}</p>
    <button
      v-if="showRetry"
      class="btn btn-outline-danger btn-sm mt-3"
      type="button"
      @click="$emit('retry')"
    >
      {{ retryLabel }}
    </button>
  </div>
</template>
