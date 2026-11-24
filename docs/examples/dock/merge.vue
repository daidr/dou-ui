<script setup>
import { ref } from 'vue'
import { FileTextIcon, FolderIcon, GitCompareIcon } from '@dou-ui/icons'
import { removeDockTab } from 'dou-ui'

const panels = [
  {
    value: 'files',
    label: '文件列表',
    icon: FolderIcon,
    pinned: true,
    draggable: false,
    mergeId: 'files',
  },
  {
    value: 'changes',
    label: '变更记录',
    icon: GitCompareIcon,
    pinned: true,
    draggable: false,
    mergeId: 'changes',
  },
  {
    value: 'spec',
    label: '上海站点工作区交互规范与设计说明',
    icon: FileTextIcon,
  },
  {
    value: 'files-copy',
    label: '文件列表（分栏副本）',
    icon: FolderIcon,
    mergeId: 'files',
  },
  {
    value: 'notes',
    label: '戴兜的跨组拖拽验收纪要',
    icon: FileTextIcon,
  },
]

const initialLayout = () => ({
  type: 'split',
  direction: 'horizontal',
  size: 56,
  start: {
    type: 'group',
    id: 'main',
    tabs: ['files', 'changes', 'spec'],
    active: 'spec',
  },
  end: {
    type: 'group',
    id: 'side',
    tabs: ['files-copy', 'notes'],
    active: 'files-copy',
  },
})

const layout = ref(initialLayout())
const lastLog = ref(
  '将右侧的“文件列表（分栏副本）”拖回左侧分组，会自动合并并激活左侧的固定“文件列表”标签。',
)

function onMove(event) {
  if (event.mergedInto !== undefined) {
    lastLog.value = `已将 ${event.value} 合并到 ${event.to.group} 组的 ${event.mergedInto} 并激活。`
  } else {
    lastLog.value = `已将 ${event.value} 移动到 ${event.to.group} 组第 ${event.to.index + 1} 位。`
  }
}

function onRemove(value) {
  layout.value = removeDockTab(layout.value, value)
}

function reset() {
  layout.value = initialLayout()
  lastLog.value = '已重置分栏布局，可再次拖动副本标签测试合并效果。'
}
</script>

<template>
  <DouDock
    v-model="layout"
    class="merge-dock"
    :panels="panels"
    closable
    @move="onMove"
    @remove="onRemove"
  >
    <template #default="{ value }">
      <p class="merge-dock__title">{{ panels.find((panel) => panel.value === value)?.label }}</p>
      <p class="merge-dock__status">{{ lastLog }}</p>
    </template>
    <template #extra="{ group }">
      <DouButton v-if="group.id === 'main'" size="xs" variant="ghost" @click="reset">
        重置
      </DouButton>
    </template>
  </DouDock>
</template>

<style scoped>
.merge-dock {
  --dou-tabs-tab-max-width: 14em;
}

.merge-dock__title {
  margin: 0 0 8px;
  font-weight: 500;
}

.merge-dock__status {
  margin: 0;
  color: var(--dou-color-text-secondary);
}
</style>
