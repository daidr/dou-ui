<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { ref } from 'vue'

const head = (value) => ({ value, style: 'head' })

const book = ref({
  version: 1,
  styles: {
    head: { bold: true, fill: 'neutral', align: 'center' },
    group: { bold: true },
  },
  sheets: [
    {
      name: '季度预算',
      freeze: { rows: 2, cols: 1 },
      colCount: 8,
      rowCount: 20,
      merges: ['A1:A2', 'B1:D1', 'E1:G1', 'H1:H2', 'A3:H3', 'A7:H7'],
      cells: [
        [head('项目'), head('上半年'), null, null, head('下半年'), null, null, head('合计')],
        [
          null,
          head('一季度'),
          head('二季度'),
          head('小计'),
          head('三季度'),
          head('四季度'),
          head('小计'),
        ],
        [{ value: '人力', style: 'group' }],
        ['工资', 42000, 42000, 84000, 45000, 45000, 90000, 174000],
        ['培训', 3000, 1500, 4500, 2000, 4000, 6000, 10500],
        ['团建', 1200, 1800, 3000, 1500, 2400, 3900, 6900],
        [{ value: '办公', style: 'group' }],
        ['房租', 18000, 18000, 36000, 18000, 18000, 36000, 72000],
        ['设备', 6500, 2000, 8500, 3000, 9000, 12000, 20500],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 320px" />
</template>
