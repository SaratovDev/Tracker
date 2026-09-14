<script setup>
import PriorityDot from './PriorityDot.vue'
import StatusBadge from './StatusBadge.vue'
import AppIcon from './AppIcon.vue'
import { formatDuration } from '../utils/time'

defineProps({
  task: { type: Object, required: true }
})

const emit = defineEmits(['open'])

function onKeydown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('open')
  }
}
</script>

<template>
  <article
    class="card task-card"
    role="button"
    tabindex="0"
    :aria-label="`Открыть задачу «${task.title}»`"
    @click="emit('open')"
    @keydown="onKeydown"
  >
    <header class="task-card__header">
      <PriorityDot :priority="task.priority" />
      <h3 class="task-card__title">{{ task.title }}</h3>
    </header>
    <p v-if="task.description" class="task-card__body">{{ task.description }}</p>
    <p v-else class="task-card__body task-card__body--empty">—</p>
    <footer class="task-card__footer">
      <StatusBadge :status="task.status" />
      <span v-if="task.status === 'done'" class="task-card__time">
        <AppIcon name="clock" :size="14" />
        {{ formatDuration(task.totalTimeSeconds) }}
      </span>
    </footer>
  </article>
</template>
