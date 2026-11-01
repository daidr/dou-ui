<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { ref } from 'vue'

const head = (value) => ({ value, style: 'head' })
const money = (value, note) => ({ value, format: '¥#,##0', note })

const book = ref({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '活动预算',
      freeze: { rows: 1 },
      colSizes: { 0: 120, 3: 160 },
      rowCount: 12,
      colCount: 6,
      cells: [
        [head('项目'), head('预算'), head('负责人'), head('备注')],
        [
          { value: '场地', note: '上海展览中心 2 号厅，含两天布展。' },
          money(48000),
          '戴兜',
          '已签合同',
        ],
        ['物料', money(12600, '比去年多印了 500 份手册。\n展架沿用去年的。'), '阿青', ''],
        ['餐饮', money(9800), '阿青', '按 120 人计'],
        ['交通', money(3200), { value: '戴兜', note: '下周一前确认大巴车型。' }, ''],
        [
          { value: '合计', style: 'head' },
          { value: '=SUM(B2:B5)', format: '¥#,##0', style: 'head' },
        ],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 300px" />
</template>
