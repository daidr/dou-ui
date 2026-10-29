<script setup>
import { useColorMode } from 'dou-ui'

const { mode } = useColorMode()
const modes = [
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' },
  { value: 'system', label: '跟随系统' },
]
</script>

<template>
  <DouSegmentedControl v-model="mode" :options="modes" />
</template>
