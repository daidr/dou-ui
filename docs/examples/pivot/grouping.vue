<script setup>
import { DouSegmentedControl, DouSwitch } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { ref, watch } from 'vue'
import { fields, orders } from './orders'

const by = ref('quarter')
const top = ref(false)
const config = ref({
  rows: [{ field: 'date', by: 'quarter' }, 'region'],
  columns: ['channel'],
  values: ['amount'],
})

// 行按日期分组，打开开关时只保留销售额最高的两个地区
watch([by, top], () => {
  config.value = {
    ...config.value,
    rows: [{ field: 'date', by: by.value }, 'region'],
    filters: top.value ? { region: { top: { count: 2 } } } : {},
  }
})
const options = [
  { label: '按季度', value: 'quarter' },
  { label: '按月', value: 'month' },
]
</script>

<template>
  <div class="pivot-demo">
    <div class="pivot-demo__bar">
      <DouSegmentedControl v-model="by" :options="options" size="sm" />
      <DouSwitch v-model="top" size="sm">只看销售额前 2 的地区</DouSwitch>
    </div>
    <DouPivot v-model:config="config" :data="orders" :fields="fields" :max-height="360" />
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: var(--dou-space-md);
}

.pivot-demo__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--dou-space-md);
}
</style>
