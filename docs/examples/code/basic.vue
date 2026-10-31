<script setup>
import { DouCodeEditor, typescript } from '@dou-ui/code'
import { ref } from 'vue'

const code = ref(`// 按人数算出要订的奶茶杯数
interface Order {
  name: string
  cups: number
  sugar: '无糖' | '半糖' | '全糖'
}

export function total(orders: Order[]) {
  return orders.reduce((sum, order) => sum + order.cups, 0)
}

const orders: Order[] = [
  { name: '戴兜', cups: 2, sugar: '半糖' },
  { name: '阿青', cups: 1, sugar: '无糖' },
]

console.log(total(orders)) // 3
`)
</script>

<template>
  <DouCodeEditor v-model="code" :language="typescript" aria-label="示例代码" />
</template>
