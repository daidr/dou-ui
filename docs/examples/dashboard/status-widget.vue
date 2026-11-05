<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouSparkline } from 'dou-ui'
import { computed, onBeforeUnmount, onMounted } from 'vue'

const { props, size, setStatus } = useDashboardWidget()
// 设置不是数组时（比如旧格式写成了文字）这里会抛错，格子显示“无法显示”
const points = computed(() => props.value.points.map(Number))

let tries = 0
let timer
// 模拟取数：设置了 fail 的格子第一次会失败，点“重试”后成功
function load() {
  setStatus('loading')
  clearTimeout(timer)
  timer = setTimeout(() => {
    tries++
    if (props.value.fail && tries === 1)
      setStatus('error', { message: '服务暂时不可用', retry: load })
    else if (!props.value.points.length) setStatus('empty', { message: '这段时间没有订单' })
    else setStatus('ready')
  }, 1200)
}
onMounted(load)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <DouSparkline
    :data="points"
    type="area"
    smooth
    :width="size.width.value"
    :height="size.height.value"
  />
</template>
