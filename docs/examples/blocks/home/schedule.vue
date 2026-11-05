<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'

const { props } = useDashboardWidget()
</script>

<template>
  <ol class="schedule">
    <li v-for="event in props.events ?? []" :key="event.time + event.title" class="schedule__item">
      <time class="schedule__time">{{ event.time }}</time>
      <div class="schedule__body">
        <span class="schedule__title">{{ event.title }}</span>
        <span v-if="event.place" class="schedule__place">{{ event.place }}</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.schedule {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.schedule__item {
  display: grid;
  grid-template-columns: 3.2em minmax(0, 1fr);
  gap: 12px;
}
.schedule__time {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  font-variant-numeric: tabular-nums;
  line-height: var(--dou-font-line-height);
}
.schedule__body {
  display: grid;
  gap: 2px;
  padding-left: 12px;
  border-left: 2px solid var(--dou-color-border);
}
.schedule__title {
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-sm);
  line-height: var(--dou-font-line-height);
}
.schedule__place {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
