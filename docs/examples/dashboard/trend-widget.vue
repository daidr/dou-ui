<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouSparkline } from 'dou-ui'
import { onMounted } from 'vue'

const { props, size, setStatus } = useDashboardWidget()

// 模拟取数：加载时格子显示加载状态
onMounted(() => {
  setStatus('loading')
  setTimeout(() => setStatus('ready'), 800)
})
</script>

<template>
  <DouSparkline
    :data="props.points"
    type="area"
    smooth
    interactive
    :width="size.width.value"
    :height="size.height.value"
  />
</template>
