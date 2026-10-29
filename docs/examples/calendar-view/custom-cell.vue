<script setup>
const shifts = [
  { label: '早班', tone: 'primary' },
  { label: '晚班', tone: 'warning' },
  { label: '休息', tone: 'neutral' },
]
const shiftOf = (date) => shifts[Number(date.slice(8)) % 3]
</script>

<template>
  <DouCalendarView
    style="--dou-calendar-view-day-height: 72px"
    :disabled-date="(d) => [0, 6].includes(new Date(d).getUTCDay())"
  >
    <template #cell="{ date, outside, disabled }">
      <DouTag v-if="!outside && !disabled" size="sm" :tone="shiftOf(date).tone">
        {{ shiftOf(date).label }}
      </DouTag>
    </template>
  </DouCalendarView>
</template>
