<script setup>
import { DouSelect } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { computed, ref } from 'vue'
import { fields, orders } from './orders'

const show = ref('percentOfRow')
const options = [
  { label: '原值', value: 'none' },
  { label: '占总计', value: 'percentOfTotal' },
  { label: '占行合计', value: 'percentOfRow' },
  { label: '占列合计', value: 'percentOfColumn' },
  { label: '与上一季度的差值', value: 'difference' },
  { label: '累计', value: 'runningTotal' },
  { label: '在大区里的排名', value: 'rank' },
]
const config = computed(() => ({
  rows: ['region'],
  columns: ['quarter'],
  values: [{ field: 'amount', ...(show.value === 'none' ? {} : { show: show.value }) }],
}))
</script>

<template>
  <div class="pivot-demo">
    <DouSelect v-model="show" :options="options" size="sm" style="width: 200px" />
    <DouPivot :config="config" :data="orders" :fields="fields" />
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
