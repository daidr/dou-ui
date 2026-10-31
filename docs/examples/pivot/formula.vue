<script setup>
import { DouPivot } from '@dou-ui/pivot'
import { ref } from 'vue'
import { fields, orders } from './orders'

const config = ref({
  rows: ['category'],
  columns: ['channel'],
  values: [
    'amount',
    'cups',
    {
      formula: '销售额 / 杯数',
      label: '每杯均价',
      format: { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 },
    },
  ],
})
</script>

<template>
  <DouPivot v-model:config="config" :data="orders" :fields="fields" :max-height="360" />
</template>
