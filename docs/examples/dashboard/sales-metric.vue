<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouStatistic } from 'dou-ui'

// data 是 props.source 指定的数据源按当前筛选取回的结果
const { props, data } = useDashboardWidget()
</script>

<template>
  <div class="metric">
    <DouStatistic :value="data?.[props.field] ?? 0" :prefix="props.prefix" :suffix="props.suffix" />
  </div>
</template>

<style scoped>
.metric {
  display: flex;
  align-items: flex-end;
  height: 100%;
}
</style>
