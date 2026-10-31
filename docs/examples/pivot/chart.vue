<script setup>
import { DouChart, DouChartBar } from '@dou-ui/chart'
import { DouPivot } from '@dou-ui/pivot'
import { computed, ref } from 'vue'
import { fields, orders } from './orders'

const config = ref({ rows: ['region', 'city'], columns: ['channel'], values: ['amount'] })
const collapsed = ref({ rows: [['华东'], ['华南'], ['华北'], ['西南']] })
const pivot = ref()

// 表格怎么展开，图就怎么画：展开一个大区，图里换成它的城市
const chart = computed(() => pivot.value?.toChartRows() ?? { x: 'label', rows: [], series: [] })
</script>

<template>
  <div class="pivot-demo">
    <DouPivot
      ref="pivot"
      v-model:config="config"
      v-model:collapsed="collapsed"
      :data="orders"
      :fields="fields"
      :max-height="240"
    />
    <DouChart :data="chart.rows" :x="chart.x" :height="260">
      <DouChartBar v-for="s in chart.series" :key="s.key" :y="s.key" :name="s.name" stack />
    </DouChart>
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 16px;
}
</style>
