<script setup>
import { DouPivot, defineAggregator } from '@dou-ui/pivot'
import { ref } from 'vue'
import { fields, orders } from './orders'

// 单笔金额的极差：每组记下最小和最大，小计由各组合并而来
const spread = defineAggregator({
  name: 'spread',
  label: '极差',
  init: () => ({ min: Infinity, max: -Infinity }),
  add: (state, value) => ({ min: Math.min(state.min, value), max: Math.max(state.max, value) }),
  merge: (a, b) => ({ min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) }),
  result: (state) => state.max - state.min,
})

const config = ref({
  rows: ['category'],
  values: [
    { field: 'amount', aggregate: 'median' },
    { field: 'amount', aggregate: 'spread' },
    { field: 'city', aggregate: 'distinct', label: '覆盖城市' },
  ],
})
</script>

<template>
  <DouPivot
    v-model:config="config"
    :data="orders"
    :fields="fields"
    :aggregators="[spread]"
    :height="260"
  />
</template>
