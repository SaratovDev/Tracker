<script setup>
import { useToastStore } from '../stores/toast'

const toast = useToastStore()
</script>

<template>
  <div class="toast-container" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="item in toast.items" :key="item.id" class="toast">{{ item.message }}</div>
    </TransitionGroup>
  </div>
</template>
