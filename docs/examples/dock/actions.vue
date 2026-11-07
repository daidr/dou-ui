<script setup>
import { LayoutColumnsIcon, LayoutRowsIcon } from '@dou-ui/icons'
import { ref } from 'vue'
import { moveDockTab, removeDockTab, splitDockTab } from 'dou-ui'

const panels = ref([
  { value: 'thread', label: '需求讨论' },
  { value: 'plan', label: '发布计划' },
  { value: 'api', label: '接口文档' },
  { value: 'log', label: '构建日志' },
])

const layout = ref({ type: 'group', id: 'main', tabs: ['thread', 'plan', 'api', 'log'] })

// splits the selected tab of a group off; a group of one tab has nothing to split from
function split(group, side) {
  layout.value = splitDockTab(layout.value, group.active ?? group.tabs[0], group.id, side)
}
function remove(value) {
  layout.value = removeDockTab(layout.value, value)
}
let next = 1
function add(group) {
  const value = `note-${next}`
  panels.value.push({ value, label: `笔记 ${next++}` })
  layout.value = moveDockTab(layout.value, value, group)
}
</script>

<template>
  <DouDock v-model="layout" :panels="panels" closable addable @remove="remove" @add="add">
    <template #default="{ value }">{{
      panels.find((panel) => panel.value === value).label
    }}</template>
    <template #extra="{ group }">
      <DouTooltip content="向右拆分">
        <DouButton
          variant="ghost"
          size="sm"
          aria-label="向右拆分"
          :disabled="group.tabs.length < 2"
          @click="split(group, 'right')"
        >
          <LayoutColumnsIcon />
        </DouButton>
      </DouTooltip>
      <DouTooltip content="向下拆分">
        <DouButton
          variant="ghost"
          size="sm"
          aria-label="向下拆分"
          :disabled="group.tabs.length < 2"
          @click="split(group, 'bottom')"
        >
          <LayoutRowsIcon />
        </DouButton>
      </DouTooltip>
    </template>
    <template #empty>没有打开的标签</template>
  </DouDock>
</template>
