<script setup>
import { ref } from 'vue'
import { findDockGroup, moveDockTab, removeDockTab, splitDockTab } from 'dou-ui'

const panels = ref([
  { value: 'thread', label: '需求讨论' },
  { value: 'plan', label: '发布计划' },
  { value: 'api', label: '接口文档' },
  { value: 'log', label: '构建日志' },
])

const layout = ref({ type: 'group', id: 'main', tabs: ['thread', 'plan', 'api', 'log'] })

// a tab alone in its group has nothing to split from
const alone = (value) => findDockGroup(layout.value, value).tabs.length === 1

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
  <DouDock v-model="layout" :panels="panels" closable addable @remove="remove" @add="add">
    <template #default="{ value }">
      <DouSpace>
        <DouButton size="sm" :disabled="alone(value)" @click="split(value, 'right')">
          向右拆分
        </DouButton>
        <DouButton size="sm" :disabled="alone(value)" @click="split(value, 'bottom')">
          向下拆分
        </DouButton>
      </DouSpace>
    </template>
    <template #empty>没有打开的标签</template>
  </DouDock>
</template>
