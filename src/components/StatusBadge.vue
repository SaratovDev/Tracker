<script setup>
import { computed } from 'vue'
import { STATUS_META } from '../utils/meta'

const props = defineProps({
  status: { type: String, required: true }
})

const className = computed(() => {
  if (props.status === 'in_progress') return 'status-in-progress'
  return `status-${props.status}`
})
</script>

<template>
  <span class="status-badge" :class="className">{{ STATUS_META[status]?.label || status }}</span>
</template>
