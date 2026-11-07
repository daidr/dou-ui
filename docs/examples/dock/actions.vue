<script setup>
import { ref, useTemplateRef } from 'vue'
import { findDockGroup, moveDockTab, removeDockTab, splitDockTab } from 'dou-ui'

const panels = ref([
  { value: 'thread', label: '需求讨论' },
  { value: 'plan', label: '发布计划' },
  { value: 'api', label: '接口文档' },
  { value: 'log', label: '构建日志' },
])

const layout = ref({ type: 'group', id: 'main', tabs: ['thread', 'plan', 'api', 'log'] })

const dock = useTemplateRef('dock')

// a tab alone in its group has nothing to split from, and a small group has no room
function canSplit(value, side) {
  const group = findDockGroup(layout.value, value)
  return group.tabs.length > 1 && !!dock.value?.canSplit(group.id, side)
}
function split(value, side) {
  layout.value = splitDockTab(layout.value, value, findDockGroup(layout.value, value).id, side)
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
    <template #default="{ value }">
      <DouSpace>
        <DouButton size="sm" :disabled="!canSplit(value, 'right')" @click="split(value, 'right')">
          向右拆分
        </DouButton>
        <DouButton size="sm" :disabled="!canSplit(value, 'bottom')" @click="split(value, 'bottom')">
          向下拆分
        </DouButton>
      </DouSpace>
    </template>
    <template #empty>没有打开的标签</template>
  </DouDock>
</template>
