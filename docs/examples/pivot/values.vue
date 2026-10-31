<script setup>
import { DouSegmentedControl } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { ref } from 'vue'
import { fields, orders } from './orders'

const config = ref({
  rows: ['category'],
  columns: ['channel'],
  values: [
    'amount',
    { field: 'cups', aggregate: 'sum' },
    { field: 'amount', aggregate: 'avg', label: '客单价' },
  ],
  valuesOn: 'columns',
})
const options = [
  { label: '值放在列上', value: 'columns' },
  { label: '值放在行上', value: 'rows' },
]
</script>

<template>
  <div class="pivot-demo">
    <DouSegmentedControl v-model="config.valuesOn" :options="options" size="sm" />
    <DouPivot v-model:config="config" :data="orders" :fields="fields" :height="360" />
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
</style>
