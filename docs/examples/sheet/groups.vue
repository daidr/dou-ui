<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { ref } from 'vue'

const head = (value) => ({ value, style: 'head' })
const money = (value, style) => ({ value, format: '#,##0', style })

/** A row of quarters, with the year's total before them. */
function line(name, quarters, style) {
  const row = 1 + rows.length
  const cells = [
    { value: name, style },
    money(`=SUM(C${row}:F${row})`, style),
    ...quarters.map((q) => money(q, style)),
  ]
  rows.push(cells)
}
/** A region's subtotal row, summing the stores below it. */
function region(name, stores) {
  const row = 1 + rows.length
  const sums = ['C', 'D', 'E', 'F'].map(
    (col) => `=SUM(${col}${row + 1}:${col}${row + stores.length})`,
  )
  line(name, sums, 'region')
  for (const [store, quarters] of stores) line(store, quarters)
}

const rows = [
  [head('门店'), head('全年'), head('一季度'), head('二季度'), head('三季度'), head('四季度')],
]
line('全部门店', ['=C3+C7', '=D3+D7', '=E3+E7', '=F3+F7'], 'total')
region('华东', [
  ['上海', [128, 136, 142, 160]],
  ['杭州', [96, 102, 99, 118]],
  ['南京', [74, 80, 86, 91]],
])
region('华南', [
  ['广州', [88, 92, 97, 110]],
  ['深圳', [102, 108, 115, 126]],
])

const book = ref({
  styles: {
    head: { bold: true, fill: 'neutral' },
    total: { bold: true },
    region: { bold: true, fill: 'neutral' },
  },
  sheets: [
    {
      name: '销售额（万元）',
      freeze: { rows: 1 },
      colSizes: { 0: 104 },
      rowCount: 20,
      colCount: 8,
      cells: rows,
      groups: [
        { range: '3:9' },
        { range: '4:6' },
        { range: '8:9', collapsed: true },
        { range: 'C:F' },
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 320px" />
</template>
