<script setup>
const shifts = [
  { label: '早班', short: '早', tone: 'primary' },
  { label: '晚班', short: '晚', tone: 'warning' },
  { label: '休息', short: '休', tone: 'neutral' },
]
const shiftOf = (date) => shifts[Number(date.slice(8)) % 3]
</script>

<template>
  <DouCalendarView
    style="--dou-calendar-view-day-height: 72px"
    :disabled-date="(d) => [0, 6].includes(new Date(d).getUTCDay())"
  >
    <template #cell="{ date, outside, disabled }">
      <div v-if="!outside && !disabled" class="shift">
        <DouTag size="sm" :tone="shiftOf(date).tone">
          <span class="shift-full">{{ shiftOf(date).label }}</span>
          <span class="shift-short">{{ shiftOf(date).short }}</span>
        </DouTag>
      </div>
    </template>
  </DouCalendarView>
</template>

<style scoped>
/* 按日期格本身的宽度判断：格子放不下两个字时（手机、窄侧栏）改用单字 */
.shift {
  container-type: inline-size;
}
.shift-short {
  display: none;
}
@container (width < 40px) {
  .dou-tag {
    --dou-tag-padding-x: 4px;
  }
  .shift-full {
    display: none;
  }
  .shift-short {
    display: inline;
  }
}
</style>
