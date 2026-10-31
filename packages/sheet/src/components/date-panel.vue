<script setup lang="ts">
import { DouCalendar, type CalendarInstance } from 'dou-ui'
import { computed, useTemplateRef, watch } from 'vue'
import type { SheetCellPanelProps } from '../core/cell-type'
import { parseInput } from '../core/format'
import type { SheetValue } from '../core/model'

const props = defineProps<SheetCellPanelProps>()
const emit = defineEmits<{ pick: [value: SheetValue] }>()
const calendar = useTemplateRef<CalendarInstance>('calendar')

const DAY = /^(\d{4}-\d{2}-\d{2})( .+)?$/

/** The day in the cell, or in what is typed once it reads as one. */
const day = computed(() => {
  const value = props.typed ? parseInput(props.text).value : props.value
  return typeof value === 'string' ? (DAY.exec(value)?.[1] ?? null) : null
})
watch(day, (value) => value && calendar.value?.show(value))

function pick(value: unknown) {
  if (typeof value !== 'string') return
  // a time in the cell stays as it was
  const time = typeof props.value === 'string' ? (DAY.exec(props.value)?.[2] ?? '') : ''
  emit('pick', value + time)
}
</script>

<template>
  <DouCalendar ref="calendar" class="dou-sheet__calendar" :model-value="day" @select="pick" />
</template>
