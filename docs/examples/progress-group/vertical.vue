<script setup>
const budget = [
  { label: '设计', value: 4.8 },
  { label: '研发', value: 12.6 },
  { label: '测试与质量保障', value: 3.2 },
  { label: '运营推广', value: 2.4 },
]
</script>

<template>
  <div style="width: 100%; max-width: 320px">
    <DouProgressGroup
      :items="budget"
      legend
      legend-direction="vertical"
      label="项目预算"
      :format="(value, percent) => `${value} 万 · ${Math.round(percent)}%`"
    />
  </div>
</template>
