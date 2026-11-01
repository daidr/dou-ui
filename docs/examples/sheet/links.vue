<script setup>
import { DouSheet, DouSheetTabs } from '@dou-ui/sheet'
import { ref } from 'vue'

const head = (value) => ({ value, style: 'head' })

const book = ref({
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '门店',
      freeze: { rows: 1 },
      colSizes: { 0: 120, 1: 200, 2: 160 },
      rowCount: 10,
      colCount: 5,
      cells: [
        [head('门店'), head('页面'), head('店长')],
        [
          '上海静安店',
          { value: '门店主页', link: 'https://ui.daidr.me' },
          { value: '戴兜', link: 'mailto:daidr@daidr.me' },
        ],
        ['上海徐汇店', '=HYPERLINK("#销售!B3", "查看销售")', '阿青'],
        ['上海浦东店', { value: '电话预约', link: 'tel:02100000000' }, '小林'],
      ],
    },
    {
      name: '销售',
      cells: [
        [head('门店'), head('本月')],
        ['上海静安店', 182000],
        ['上海徐汇店', 156400],
        ['上海浦东店', 201300],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 320px">
    <template #footer>
      <DouSheetTabs />
    </template>
  </DouSheet>
</template>
