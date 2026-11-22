<script setup>
import { ref } from 'vue'
import { FileTextIcon, FolderIcon, GitCompareIcon, ListChecksIcon } from '@dou-ui/icons'
import { removeDockTab } from 'dou-ui'

const panels = [
  { value: 'files', label: '文件', icon: FolderIcon, pinned: true },
  { value: 'changes', label: '变更', icon: GitCompareIcon, pinned: true },
  { value: 'plan', label: '计划', icon: ListChecksIcon, pinned: true },
  { value: 'readme', label: 'README.md', icon: FileTextIcon },
  { value: 'tabs', label: 'tabs.vue', icon: FileTextIcon },
  { value: 'dock', label: 'dock.vue', icon: FileTextIcon },
  { value: 'theme', label: 'tabs.css', icon: FileTextIcon },
  { value: 'notes', label: '发布说明.md', icon: FileTextIcon },
  { value: 'changelog', label: 'CHANGELOG.md', icon: FileTextIcon },
]

const layout = ref({
  type: 'split',
  direction: 'horizontal',
  size: 62,
  start: {
    type: 'group',
    id: 'main',
    tabs: ['files', 'changes', 'plan', 'readme', 'tabs', 'dock', 'theme', 'notes'],
    active: 'readme',
  },
  end: {
    type: 'group',
    id: 'side',
    tabs: ['changelog'],
    active: 'changelog',
  },
})

function onRemove(value) {
  layout.value = removeDockTab(layout.value, value)
}
</script>

<template>
  <DouDock v-model="layout" :panels="panels" closable @remove="onRemove">
    <template #default="{ value }">
      {{ panels.find((panel) => panel.value === value)?.label }} 的内容。
    </template>
  </DouDock>
</template>
