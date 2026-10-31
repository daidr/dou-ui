<script setup>
import { DouCodeDiff, javascript } from '@dou-ui/code'
import { ref } from 'vue'

const header = `// 配送费计算，戴兜维护
import { round } from './math'

const BASE_FEE = 6
const FREE_OVER = 99
`
const helpers = Array.from(
  { length: 12 },
  (_, i) => `export function zone${i + 1}(order) {\n  return order.zone === ${i + 1}\n}\n`,
).join('\n')

const original = `${header}
export function shippingFee(order) {
  if (order.total >= FREE_OVER) return 0
  let fee = BASE_FEE
  if (order.city !== '上海') fee += 4
  return fee
}

${helpers}
export default shippingFee
`

const modified = ref(`${header}const REMOTE_FEE = 8

export function shippingFee(order, options = {}) {
  if (order.total >= FREE_OVER || options.member) return 0
  let fee = BASE_FEE
  if (order.city !== '上海') fee += REMOTE_FEE
  return round(fee, 2)
}

${helpers}
export default shippingFee
`)
</script>

<template>
  <DouCodeDiff v-model="modified" :original="original" :language="javascript" :readonly="false" />
</template>
