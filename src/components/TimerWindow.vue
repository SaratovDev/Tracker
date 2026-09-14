<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import AppIcon from './AppIcon.vue'
import { formatClock } from '../utils/time'

const store = useAppStore()

const activeTask = computed(() => store.activeTask)
const time = computed(() => formatClock(activeTask.value?.totalTimeSeconds || 0))
</script>

<template>
  <Transition name="timer-window">
    <div v-if="activeTask" class="timer-window" role="status">
      <AppIcon name="clock" :size="18" />
      <div class="timer-window__info">
        <span class="timer-window__title">{{ activeTask.title }}</span>
        <span class="timer-window__time">{{ time }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.timer-window {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 340px;
  background: var(--color-ink);
  color: var(--color-surface);
  padding: 14px 20px;
  box-shadow: 4px 4px 0 rgba(20, 20, 20, 0.15);
}

.timer-window__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.timer-window__title {
  font-size: var(--fs-meta-label);
  line-height: var(--lh-meta-label);
  letter-spacing: var(--ls-meta-label);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timer-window__time {
  font-size: 24px;
  line-height: 1.1;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.timer-window-enter-active,
.timer-window-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.timer-window-enter-from,
.timer-window-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
