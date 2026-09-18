<script setup>
defineProps({
  message: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="border rounded bg-white p-4 text-center text-body-secondary">
    {{ message }}
  </div>
</template>
