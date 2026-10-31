<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { ref } from 'vue'

const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
const stores = ['静安店', '徐汇店', '浦东店', '虹口店', '长宁店', '闵行店', '宝山店', '杨浦店']

const book = ref({
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '门店销售',
      freeze: { rows: 1, cols: 1 },
      colCount: 13,
      rowCount: 40,
      cells: [
        [{ value: '门店', style: 'head' }, ...months.map((value) => ({ value, style: 'head' }))],
        ...Array.from({ length: 32 }, (_, i) => [
          `${stores[i % stores.length]} ${Math.floor(i / stores.length) + 1} 组`,
          ...months.map((__, m) => ({
            value: Math.round(80000 + Math.sin(i * 3 + m) * 30000 + m * 2000),
            format: '#,##0',
          })),
        ]),
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 360px" />
</template>
