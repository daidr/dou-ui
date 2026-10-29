<script setup>
import { ref } from 'vue'

const org = [
  {
    key: 'eng',
    label: '研发部',
    children: [
      {
        key: 'fe',
        label: '前端组',
        children: [
          { key: 'u1', label: '林一' },
          { key: 'u2', label: '周二' },
        ],
      },
      {
        key: 'be',
        label: '后端组',
        children: [
          { key: 'u3', label: '陈三' },
          { key: 'u4', label: '吴四', disabled: true },
        ],
      },
    ],
  },
  { key: 'design', label: '设计部', children: [{ key: 'u5', label: '郑五' }] },
]
const checked = ref(['fe'])
</script>

<template>
  <DouTree
    v-model:checked="checked"
    :data="org"
    checkable
    :selectable="false"
    default-expand-all
    aria-label="成员"
  />
  <DouText variant="tertiary" size="sm">已勾选：{{ checked.join('、') || '无' }}</DouText>
</template>
