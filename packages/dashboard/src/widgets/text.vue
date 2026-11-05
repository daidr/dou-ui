<script setup lang="ts">
import { computed } from 'vue'
import { useDashboardWidget } from '../widget/context'
import type { TextWidgetProps } from './types'

defineOptions({ name: 'DouDashboardTextWidget' })

const { props } = useDashboardWidget<TextWidgetProps>()
const sizes = ['sm', 'md', 'lg']
const size = computed(() => (sizes.includes(props.value.size as string) ? props.value.size : 'md'))
const text = computed(() => {
  const value = props.value.text
  return typeof value === 'string' || typeof value === 'number' ? value : ''
})
</script>

<template>
  <div :class="['dou-dashboard-text', `is-${size}`]">{{ text }}</div>
</template>
