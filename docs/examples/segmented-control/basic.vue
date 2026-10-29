<script setup>
import { ref } from 'vue'

const view = ref('list')
</script>

<template>
  <DouSegmentedControl
    v-model="view"
    :options="[
      { value: 'list', label: '列表' },
      { value: 'board', label: '看板' },
      { value: 'timeline', label: '时间线' },
    ]"
  />
  <DouText variant="tertiary" size="sm">当前值：{{ view }}</DouText>
</template>
