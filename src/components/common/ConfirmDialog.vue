<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  confirmLabel: {
    type: String,
    default: 'Подтвердить',
  },
  isProcessing: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['confirm', 'cancel'])
const cancelButton = ref(null)

watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      await nextTick()
      cancelButton.value?.focus()
    }
  },
)

function cancel() {
  if (!props.isProcessing) {
    emit('cancel')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" @keydown.esc="cancel">
      <div
        class="modal d-block"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
      >
        <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h2 id="confirmation-dialog-title" class="modal-title fs-5">{{ title }}</h2>
              <button
                class="btn-close"
                type="button"
                aria-label="Закрыть"
                :disabled="isProcessing"
                @click="cancel"
              ></button>
            </div>
            <div class="modal-body">
              <p id="confirmation-dialog-description" class="mb-0">{{ message }}</p>
              <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">
                {{ errorMessage }}
              </div>
            </div>
            <div class="modal-footer">
              <button
                ref="cancelButton"
                class="btn btn-outline-secondary"
                type="button"
                :disabled="isProcessing"
                @click="cancel"
              >
                Отмена
              </button>
              <button
                class="btn btn-danger"
                type="button"
                :disabled="isProcessing"
                @click="$emit('confirm')"
              >
                <span
                  v-if="isProcessing"
                  class="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                ></span>
                {{ isProcessing ? 'Удаление…' : confirmLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    </div>
  </Teleport>
</template>
