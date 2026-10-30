<script setup>
const week = [
  { label: '周一', value: 132 },
  { label: '周二', value: 148 },
  { label: '周三', value: 121 },
  { label: '周四', value: 176 },
  { label: '周五', value: 198 },
  { label: '周六', value: null },
  { label: '周日', value: 64 },
]
</script>

<template>
  <DouSparkline :data="week" :width="240" :height="48" smooth :markers="['max']">
    <template #tooltip="{ label, value }"> {{ label }} · {{ value }} 次部署 </template>
  </DouSparkline>
</template>
