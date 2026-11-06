<script setup>
import { ref } from 'vue'
import { findDockGroup, removeDockTab, splitDockTab } from 'dou-ui'

const labels = { thread: '需求讨论', plan: '发布计划', api: '接口文档', log: '构建日志' }
const panels = Object.entries(labels).map(([value, label]) => ({ value, label }))

const layout = ref({ type: 'group', id: 'main', tabs: ['thread', 'plan', 'api', 'log'] })

function split(value, side) {
  layout.value = splitDockTab(layout.value, value, findDockGroup(layout.value, value).id, side)
}
function remove(value) {
  layout.value = removeDockTab(layout.value, value)
}
</script>

<template>
  <DouDock v-model="layout" :panels="panels" closable @remove="remove">
    <template #default="{ value }">
      <DouSpace>
        <DouButton size="sm" @click="split(value, 'right')">向右拆分</DouButton>
        <DouButton size="sm" @click="split(value, 'bottom')">向下拆分</DouButton>
      </DouSpace>
    </template>
    <template #empty>标签都关掉了</template>
  </DouDock>
</template>
