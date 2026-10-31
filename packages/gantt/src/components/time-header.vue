<script setup lang="ts">
import type { WorkCalendar } from '../core/calendar'
import type { TimeUnit } from '../core/scale'
import { dayIndex } from '../core/time'
import type { HeaderCell } from '../time-axis'

defineProps<{
  topCells: HeaderCell[]
  bottomCells: HeaderCell[]
  bottomUnit: TimeUnit
  calendar: WorkCalendar
  now: number
  todayX: number | null
}>()
defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <div class="dou-gantt__header" aria-hidden="true">
    <div class="dou-gantt__tier is-top">
      <div
        v-for="cell in topCells"
        :key="cell.key"
        class="dou-gantt__cell"
        :style="{ left: `${cell.left}px`, width: `${cell.width}px` }"
      >
        <span class="dou-gantt__cell-label">{{ cell.label }}</span>
      </div>
    </div>
    <div class="dou-gantt__tier is-bottom">
      <div
        v-for="cell in bottomCells"
        :key="cell.key"
        class="dou-gantt__cell"
        :class="{
          'is-now': todayX != null && now >= cell.key && now < cell.end,
          'is-off': bottomUnit === 'day' && !calendar.isWorkday(dayIndex(cell.key)),
        }"
        :style="{ left: `${cell.left}px`, width: `${cell.width}px` }"
      >
        <span class="dou-gantt__cell-label">{{ cell.label }}</span>
      </div>
    </div>
    <div v-if="todayX != null" class="dou-gantt__today-mark" :style="{ left: `${todayX}px` }" />
    <slot />
  </div>
</template>
