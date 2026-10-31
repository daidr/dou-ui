<script setup>
import { DouPivot } from '@dou-ui/pivot'
import { ref } from 'vue'
import { fields, orders } from './orders'

// 行：大区 → 城市；列：季度；值：销售额求和
const config = ref({
  rows: ['region', 'city'],
  columns: ['quarter'],
  values: ['amount'],
})
</script>

<template>
  <DouPivot v-model:config="config" :data="orders" :fields="fields" :height="420" />
</template>
