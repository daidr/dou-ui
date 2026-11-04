<script setup lang="ts">
import { FilterIcon, MoreVerticalIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const status = ref('全部')
</script>

<template>
  <DouTooltip content="筛选">
    <DouPopover title="筛选" placement="bottom-start">
      <DouButton variant="outline" aria-label="筛选"><FilterIcon /></DouButton>
      <template #content>
        <DouSegmentedControl v-model="status" :options="['全部', '进行中', '已完成']" />
      </template>
    </DouPopover>
  </DouTooltip>
  <DouTooltip content="更多操作">
    <DouDropdown
      :items="[
        { key: 'rename', label: '重命名' },
        { key: 'copy', label: '复制一份' },
      ]"
    >
      <DouButton variant="ghost" aria-label="更多操作"><MoreVerticalIcon /></DouButton>
    </DouDropdown>
  </DouTooltip>
</template>
