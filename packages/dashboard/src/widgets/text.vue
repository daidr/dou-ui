<script setup lang="ts">
import { useDashboardWidget } from '../widget/context'
import type { TextWidgetProps } from './types'

defineOptions({ name: 'DouDashboardTextWidget' })

const { props } = useDashboardWidget<TextWidgetProps>()
</script>

<template>
  <div :class="['dou-dashboard-text', `is-${props.size ?? 'md'}`]">{{ props.text }}</div>
</template>
