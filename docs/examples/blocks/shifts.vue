<script setup>
import { DouSheet, DouSheetTabs, DouSheetToolbar, columnName, valueOf } from '@dou-ui/sheet'
import { SheetFormulaEngine } from '@dou-ui/sheet/formula'
import { computed, ref, shallowRef, triggerRef } from 'vue'

const head = (value) => ({ value, style: 'head' })
const side = (value) => ({ value, style: 'side' })

/* 一家咖啡店下周的排班：早班 7:00–15:00，晚班 14:00–22:00，各 8 小时 */
const days = [
  '11/2 周一',
  '11/3 周二',
  '11/4 周三',
  '11/5 周四',
  '11/6 周五',
  '11/7 周六',
  '11/8 周日',
]
const shifts = [
  { value: '早班', tone: 'primary' },
  { value: '晚班', tone: 'warning' },
  { value: '休息' },
  { value: '请假', tone: 'danger' },
]
const staff = [
  ['戴兜', '店长', '早班 早班 早班 早班 早班 休息 休息'],
  ['阿青', '咖啡师', '晚班 晚班 休息 休息 早班 早班 晚班'],
  ['小林', '咖啡师', '早班 休息 晚班 晚班 休息 晚班 早班'],
  ['周周', '咖啡师', '休息 早班 早班 晚班 晚班 休息 早班'],
  ['老陈', '收银', '晚班 晚班 晚班 休息 请假 晚班 晚班'],
  ['小满', '收银', '晚班 晚班 晚班 早班 晚班 晚班 晚班'],
]
const first = 2 // 第一个人所在的行
const lastRow = first + staff.length - 1
const dayCols = days.map((_, i) => columnName(i + 2)) // C 到 I

const countRow = (label, shift) => [
  side(label),
  side(null),
  ...dayCols.map((col) => ({
    value: `=COUNTIF(${col}${first}:${col}${lastRow},"${shift}")`,
    style: 'side',
  })),
]

const book = ref({
  styles: {
    head: { bold: true, fill: 'neutral', align: 'center' },
    side: { fill: 'neutral', align: 'center' },
    short: { fill: 'warning', tone: 'warning' },
    over: { fill: 'danger', tone: 'danger' },
  },
  sheets: [
    {
      name: '下周排班',
      freeze: { rows: 1, cols: 1 },
      rowCount: 30,
      colCount: 12,
      colSizes: {
        0: 72,
        1: 64,
        ...Object.fromEntries(days.map((_, i) => [i + 2, 76])),
        9: 56,
        10: 56,
      },
      cells: [
        ['姓名', '岗位', ...days, '工时', '休息'].map(head),
        ...staff.map(([name, role, plan], i) => {
          const row = first + i
          const range = `C${row}:I${row}`
          return [
            name,
            role,
            ...plan.split(' '),
            { value: `=(COUNTIF(${range},"早班")+COUNTIF(${range},"晚班"))*8`, format: '0"h"' },
            { value: `=COUNTIF(${range},"休息")`, format: '0"天"' },
          ]
        }),
        [],
        countRow('早班人数', '早班'),
        countRow('晚班人数', '晚班'),
      ],
      validations: [
        {
          range: `C${first}:I${lastRow}`,
          list: shifts,
          prompt: '早班 7:00–15:00，晚班 14:00–22:00',
        },
      ],
      conditionalFormats: [
        // 每个班次至少要 2 个人；每周最多 40 小时，至少休息 1 天
        { range: `C${lastRow + 2}:I${lastRow + 3}`, when: { op: 'lt', value: 2 }, style: 'short' },
        { range: `J${first}:J${lastRow}`, when: { op: 'gt', value: 40 }, style: 'over' },
        { range: `K${first}:K${lastRow}`, when: { op: 'lt', value: 1 }, style: 'over' },
      ],
    },
  ],
})

/* 下方的提醒用计算引擎读表格里的结果，表格每次修改后更新 */
const engine = shallowRef(new SheetFormulaEngine(book.value))
function onTransaction(tr) {
  engine.value.update(tr)
  triggerRef(engine)
}

const notes = computed(() => {
  const results = engine.value
  const cells = results.doc.sheets[0].cells
  const list = []
  for (let row = 1; row < cells.length; row++) {
    const label = valueOf(cells[row]?.[0])
    if (typeof label !== 'string' || !label) continue
    if (label.endsWith('人数')) {
      days.forEach((day, i) => {
        const count = results.result(0, row, i + 2)
        if (typeof count === 'number' && count < 2)
          list.push({ tone: 'warning', text: `${day}${label.slice(0, 2)}只有 ${count} 人` })
      })
    } else {
      const hours = results.result(0, row, 9)
      const rest = results.result(0, row, 10)
      if (typeof hours === 'number' && hours > 40)
        list.push({ tone: 'danger', text: `${label}本周超时 ${hours - 40} 小时` })
      if (rest === 0) list.push({ tone: 'danger', text: `${label}本周没有休息` })
    }
  }
  return list
})
</script>

<template>
  <div class="shifts">
    <DouPageHeader
      title="门店排班"
      subtitle="静安店 · 2026 年 11 月 2 日至 8 日"
      :show-back="false"
      :level="2"
    />

    <div class="shifts__main">
      <DouSheet
        v-model="book"
        class="shifts__sheet"
        aria-label="门店排班"
        @transaction="onTransaction"
      >
        <template #header>
          <DouSheetToolbar :tools="['undo', 'redo', '|', 'fill', 'clear', '|', 'validation']" />
        </template>
        <template #footer>
          <DouSheetTabs />
        </template>
      </DouSheet>

      <DouCard title="排班提醒" class="shifts__notes">
        <DouEmpty v-if="!notes.length" size="sm" title="不需要调整" />
        <ul v-else class="shifts__list">
          <li v-for="note in notes" :key="note.text">
            <DouBadge :tone="note.tone" dot />
            <span>{{ note.text }}</span>
          </li>
        </ul>
      </DouCard>
    </div>
  </div>
</template>

<style scoped>
.shifts {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.shifts__main {
  display: grid;
  gap: 16px;
}
.shifts__sheet {
  height: 420px;
}
.shifts__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--dou-font-size-sm);
}
.shifts__list li {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
