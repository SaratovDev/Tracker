<script setup>
import { PRIORITY_META } from '../utils/meta'

defineProps({
  priority: { type: String, default: 'yellow' }
})
</script>

<template>
  <span class="priority-dot" :class="`priority-${priority}`" :title="PRIORITY_META[priority]?.label" />
</template>
