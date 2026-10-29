<script setup lang="ts">
import { ref } from 'vue'

const docs = [
  {
    key: 'guide',
    label: '指南',
    children: [
      { key: 'start', label: '快速开始' },
      { key: 'theme', label: '主题与 Token' },
    ],
  },
  {
    key: 'form',
    label: '表单',
    children: [
      { key: 'input', label: 'Input 输入框' },
      { key: 'select', label: 'Select 选择器' },
    ],
  },
  {
    key: 'overlay',
    label: '浮层',
    children: [
      { key: 'dialog', label: 'Dialog 对话框' },
      { key: 'tour', label: 'Tour 漫游引导' },
    ],
  },
]
const expanded = ref(['guide'])
const selected = ref('start')
</script>

<template>
  <DouTree
    v-model:expanded="expanded"
    v-model:selected="selected"
    :data="docs"
    accordion
    expand-on-click
    selectable
    style="width: 240px"
  />
</template>
