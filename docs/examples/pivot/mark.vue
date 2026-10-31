<script setup>
import { DouPivot } from '@dou-ui/pivot'
import { ref } from 'vue'
import { fields, orders } from './orders'

const config = ref({
  rows: ['city'],
  columns: ['quarter'],
  values: [
    { field: 'amount', mark: 'bar' },
    { field: 'cups', mark: { type: 'scale', tone: 'success' } },
  ],
  filters: { city: { top: { count: 6 } } },
})
</script>

<template>
  <DouPivot v-model:config="config" :data="orders" :fields="fields" :max-height="360" />
</template>
