<script setup>
import { expandRepeats, occurrenceOf } from 'dou-ui'
import { computed, ref } from 'vue'

const month = ref('2026-11')
const view = ref('agenda')
// 日历当前显示的日子，由 range-change 告诉我们
const range = ref(null)
const last = ref('—')

// 存下来的是规则；显示的是展开后的具体日程
const series = ref([
  {
    id: 'standup',
    title: '站会',
    tone: 'neutral',
    start: '2026-11-02 09:30',
    end: '2026-11-02 09:45',
    repeat: { every: 'week', weekdays: [1, 2, 3, 4, 5], except: ['2026-11-11'] },
  },
  {
    id: 'review',
    title: '双周迭代评审',
    start: '2026-11-06 15:00',
    end: '2026-11-06 16:30',
    repeat: { every: 'week', interval: 2 },
  },
  {
    id: 'report',
    title: '月度报告',
    tone: 'success',
    start: '2026-10-30',
    repeat: { every: 'month' },
  },
  { id: 'trip', title: '上海出差', tone: 'warning', start: '2026-11-17', end: '2026-11-19' },
])

const events = computed(() =>
  range.value ? expandRepeats(series.value, range.value.start, range.value.end) : [],
)

// 拖动或删除一次重复日程：只改这一天，把它从规则里排除，另存为一项普通日程
function onChange(change) {
  const hit = occurrenceOf((change.previous ?? change.event).id)
  if (!hit) {
    series.value = series.value.flatMap((item) =>
      item.id !== change.event.id ? [item] : change.kind === 'remove' ? [] : [change.event],
    )
  } else {
    series.value = series.value.map((item) =>
      item.id === hit.id
        ? { ...item, repeat: { ...item.repeat, except: [...(item.repeat.except ?? []), hit.date] } }
        : item,
    )
    if (change.kind !== 'remove')
      series.value = [...series.value, { ...change.event, id: `${hit.id}-${hit.date}` }]
  }
  last.value = `${change.event.title}（${hit ? `只改了 ${hit.date} 这一次` : '整项'}）`
}
</script>

<template>
  <DouCalendarView
    v-model:month="month"
    v-model:view="view"
    :views="['month', 'week', 'agenda']"
    :events="events"
    editable
    :hours="[8, 20]"
    @change="onChange"
    @range-change="range = $event"
  />
  <DouText size="sm" variant="tertiary">最近的修改：{{ last }}</DouText>
</template>
