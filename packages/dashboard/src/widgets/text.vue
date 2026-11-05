<script setup lang="ts">
import { computed } from 'vue'
import { useDashboardWidget } from '../widget/context'
import { textPropsOf } from './read-props'

defineOptions({ name: 'DouDashboardTextWidget' })

const { props: raw } = useDashboardWidget()
const props = computed(() => textPropsOf(raw.value))
</script>

<template>
  <div :class="['dou-dashboard-text', `is-${props.size ?? 'md'}`]">{{ props.text }}</div>
</template>
