<script setup>
import { DouSegmentedControl } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { ref } from 'vue'
import { fields, orders } from './orders'

const layout = ref('tabular')
const options = [
  { label: '紧凑式', value: 'compact' },
  { label: '表格式', value: 'tabular' },
]
const config = ref({
  rows: ['region', 'city'],
  columns: ['channel'],
  values: ['amount'],
})
</script>

<template>
  <div class="pivot-demo">
    <DouSegmentedControl v-model="layout" :options="options" size="sm" />
    <DouPivot
      v-model:config="config"
      :layout="layout"
      :data="orders"
      :fields="fields"
      :max-height="420"
    />
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
</style>
