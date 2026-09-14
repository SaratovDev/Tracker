<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  width: { type: String, default: '560px' },
  closeOnOverlay: { type: Boolean, default: true },
  closable: { type: Boolean, default: true }
})

const emit = defineEmits(['close'])

function onKeydown(e) {
  if (props.closable && e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.body.classList.add('modal-open')
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.body.classList.remove('modal-open')
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="closable && closeOnOverlay && $emit('close')">
      <div
        class="modal"
        :class="{ 'modal--wide': width === '640px', 'modal--narrow': width === '480px' }"
        :style="{ maxWidth: width }"
        role="dialog"
        aria-modal="true"
      >
        <button
          v-if="closable"
          type="button"
          class="modal-close"
          aria-label="Закрыть"
          @click="$emit('close')"
        >
          ×
        </button>
        <h2 v-if="title" class="modal-title">{{ title }}</h2>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-footer {
  margin-top: 8px;
}
</style>
