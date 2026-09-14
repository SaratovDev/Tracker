<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 16 }
})
</script>

<template>
  <svg class="icon" :width="size" :height="size" aria-hidden="true" focusable="false">
    <use :href="`/icons.svg#icon-${name}`" />
  </svg>
</template>

<style scoped>
.icon {
  display: inline-block;
  flex: none;
}
</style>
