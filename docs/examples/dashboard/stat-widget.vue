<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouStatistic } from 'dou-ui'

// 格子里用 useDashboardWidget() 读自己的设置
const { props } = useDashboardWidget()
</script>

<template>
  <div class="stat">
    <DouStatistic :value="props.value" :suffix="props.unit" />
  </div>
</template>

<style scoped>
.stat {
  display: flex;
  align-items: flex-end;
  height: 100%;
}
</style>
