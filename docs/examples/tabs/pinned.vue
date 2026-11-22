<script setup>
import { ref } from 'vue'
import { FileTextIcon, FolderIcon, GitCompareIcon, ListChecksIcon } from '@dou-ui/icons'

const tabs = ref([
  { value: 'files', label: '文件', icon: FolderIcon, pinned: true },
  { value: 'changes', label: '变更', icon: GitCompareIcon, pinned: true },
  { value: 'plan', label: '计划', icon: ListChecksIcon, pinned: true },
  ...Array.from({ length: 10 }, (_, index) => ({
    value: `doc-${index + 1}`,
    label: index === 2 ? '架构评审记录与排期说明.md' : `文档 ${index + 1}.md`,
    icon: FileTextIcon,
    pinned: false,
  })),
])

const active = ref('doc-1')

function onMove(event) {
  const next = [...tabs.value]
  const [item] = next.splice(event.from.index, 1)
  next.splice(event.to.index, 0, item)
  tabs.value = next
}

function onRemove(value) {
  const index = tabs.value.findIndex((item) => item.value === value)
  if (index < 0) return
  tabs.value.splice(index, 1)
  if (active.value === value) {
    active.value = tabs.value[Math.min(index, tabs.value.length - 1)]?.value
  }
}
</script>

<template>
  <DouTabs v-model="active" closable draggable @move="onMove" @remove="onRemove">
    <DouTabPanel
      v-for="item in tabs"
      :key="item.value"
      :value="item.value"
      :label="item.label"
      :icon="item.icon"
      :pinned="item.pinned"
    >
      {{ item.label }} 的内容。
    </DouTabPanel>
  </DouTabs>
</template>
