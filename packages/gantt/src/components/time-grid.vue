<script setup lang="ts">
import type { HeaderCell } from '../time-axis'

defineProps<{
  cells: HeaderCell[]
  shaded: { key: number; left: number; width: number }[]
}>()
</script>

<!-- behind the bars: days off and a line per header cell -->
<template>
  <div
    v-for="range in shaded"
    :key="range.key"
    class="dou-gantt__off"
    :style="{ left: `${range.left}px`, width: `${range.width}px` }"
  />
  <div
    v-for="cell in cells"
    :key="cell.key"
    class="dou-gantt__gridline"
    :style="{ left: `${cell.left}px` }"
  />
</template>
