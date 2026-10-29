<script setup>
import { ref } from 'vue'

const org = [
  {
    key: 'eng',
    label: '研发中心',
    children: [
      {
        key: 'fe',
        label: '前端组',
        children: [
          { key: 'web', label: '官网' },
          { key: 'console', label: '控制台' },
        ],
      },
      {
        key: 'be',
        label: '后端组',
        children: [
          { key: 'api', label: '开放接口' },
          { key: 'infra', label: '基础设施' },
        ],
      },
    ],
  },
  {
    key: 'design',
    label: '设计部',
    children: [
      { key: 'brand', label: '品牌' },
      { key: 'product', label: '产品设计' },
    ],
  },
  { key: 'ops', label: '运营部' },
]
const strict = ref(['eng', 'brand'])
</script>

<template>
  <DouTreeSelect v-model="strict" :data="org" multiple check-strictly default-expand-all />
</template>
