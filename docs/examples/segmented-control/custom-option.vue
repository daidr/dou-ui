<script setup>
import { LayoutColumnsIcon, ListIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const view = ref('list')
</script>

<template>
  <DouSegmentedControl
    v-model="view"
    :options="[
      { value: 'list', label: '列表' },
      { value: 'board', label: '看板' },
    ]"
  >
    <template #option="{ option }">
      <DouIcon v-if="option.value === 'list'"><ListIcon /></DouIcon>
      <DouIcon v-else><LayoutColumnsIcon /></DouIcon>
      {{ option.label }}
    </template>
  </DouSegmentedControl>
</template>
