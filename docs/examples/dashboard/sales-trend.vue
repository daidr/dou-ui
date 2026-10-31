<script setup>
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouSparkline } from 'dou-ui'

const { data, size } = useDashboardWidget()
</script>

<template>
  <DouSparkline
    :data="data ?? []"
    type="area"
    smooth
    interactive
    :width="size.width.value"
    :height="size.height.value"
  />
</template>
