<script setup>
import { MoreHorizontalIcon } from '@dou-ui/icons'
import { ref, useTemplateRef } from 'vue'
import { moveDockTab, removeDockTab, splitDockTab } from 'dou-ui'

const panels = ref([
  { value: 'thread', label: '需求讨论' },
  { value: 'plan', label: '发布计划' },
  { value: 'api', label: '接口文档' },
  { value: 'log', label: '构建日志' },
])

const layout = ref({ type: 'group', id: 'main', tabs: ['thread', 'plan', 'api', 'log'] })

const sides = [
  { side: 'right', label: '向右拆分' },
  { side: 'bottom', label: '向下拆分' },
]

const dock = useTemplateRef('dock')

// a group of one tab has nothing to split from, and a small group has no room
const canSplit = (group, side) => group.tabs.length > 1 && !!dock.value?.canSplit(group.id, side)

// splits the selected tab of a group off
function split(group, active, side) {
  layout.value = splitDockTab(layout.value, active, group.id, side)
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
  <DouDock
    ref="dock"
    v-model="layout"
    :panels="panels"
    closable
    addable
    @remove="remove"
    @add="add"
  >
    <template #default="{ value }">{{
      panels.find((panel) => panel.value === value).label
    }}</template>
    <template #extra="{ group, active }">
      <DouDropdown placement="bottom-end" @select="split(group, active, $event)">
        <DouButton variant="ghost" size="sm" aria-label="这一组的更多操作">
          <MoreHorizontalIcon />
        </DouButton>
        <template #menu>
          <DouDropdownItem
            v-for="item in sides"
            :key="item.side"
            :value="item.side"
            :disabled="!canSplit(group, item.side)"
          >
            {{ item.label }}
          </DouDropdownItem>
        </template>
      </DouDropdown>
    </template>
    <template #empty>没有打开的标签</template>
  </DouDock>
</template>
