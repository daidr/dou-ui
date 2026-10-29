<script setup>
import { ref } from 'vue'

const pages = ref([
  {
    key: 'guide',
    label: '指南',
    children: [
      { key: 'intro', label: '介绍' },
      { key: 'install', label: '安装' },
      { key: 'theme', label: '主题' },
    ],
  },
  {
    key: 'components',
    label: '组件',
    children: [
      { key: 'button', label: 'Button 按钮' },
      { key: 'input', label: 'Input 输入框' },
    ],
  },
  { key: 'changelog', label: '更新日志', isLeaf: true },
  { key: 'faq', label: '常见问题', isLeaf: true },
])
const expanded = ref(['guide', 'components'])
const last = ref('')

const labels = { before: '之前', after: '之后', inside: '里面' }
function onDrop({ node, target, position }) {
  last.value = `${node.label} → ${target.label}${labels[position]}`
}
</script>

<template>
  <DouTree
    v-model:data="pages"
    v-model:expanded="expanded"
    draggable
    :allow-drag="(node) => node.key !== 'changelog'"
    aria-label="文档目录"
    @drop="onDrop"
  />
  <DouText variant="tertiary" size="sm">{{ last || '拖动节点调整顺序或层级' }}</DouText>
</template>
