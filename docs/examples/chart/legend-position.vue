<script setup>
import { ref } from 'vue'
import { DouSegmentedControl } from 'dou-ui'
import { DouChart, DouChartAxis, DouChartBar } from '@dou-ui/chart'

// 八家门店本月的销售额（万元）
const stores = ['上海', '北京', '杭州', '南京', '苏州', '成都', '武汉', '西安']
const rows = ['第一周', '第二周', '第三周', '第四周'].map((week, w) => {
  const row = { week }
  stores.forEach((store, i) => (row[store] = 20 + ((i * 7 + w * 5) % 13)))
  return row
})

const placement = ref('right')
</script>

<template>
  <div class="demo">
    <DouSegmentedControl
      v-model="placement"
      :options="[
        { value: 'top', label: '上方' },
        { value: 'bottom', label: '下方' },
        { value: 'right', label: '右侧' },
      ]"
      size="sm"
    />
    <DouChart :data="rows" x="week" :height="300" :legend-placement="placement">
      <DouChartAxis for="y" title="销售额（万元）" />
      <DouChartBar v-for="store in stores" :key="store" :y="store" :name="store" stack />
    </DouChart>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}
</style>
