<script setup lang="ts">
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouSegmentedControl } from 'dou-ui'
import { computed, ref } from 'vue'

const layout = ref<'vertical' | 'horizontal'>('vertical')

// 栅格默认 12 列；`span: { sm: 6 }` 在表单宽度达到 480px 时占半行，更窄时占满一行
const form = computed<FormDocument>(() => ({
  version: 1,
  layout: layout.value,
  nodes: [
    {
      id: 'device',
      type: 'section',
      title: '设备信息',
      description: '设备背面的标签上可以找到编号',
      children: [
        {
          id: 'kind',
          type: 'select',
          name: 'device.kind',
          label: '设备类型',
          span: { sm: 6 },
          props: { options: ['笔记本电脑', '显示器', '打印机', '投影仪'] },
        },
        {
          id: 'code',
          type: 'input',
          name: 'device.code',
          label: '资产编号',
          span: { sm: 6 },
          props: { placeholder: '例如 SH-2026-0153' },
        },
        {
          id: 'bought',
          type: 'date-picker',
          name: 'device.bought',
          label: '购买日期',
          span: { sm: 6 },
        },
        {
          id: 'level',
          type: 'segmented-control',
          name: 'level',
          label: '紧急程度',
          span: { sm: 6 },
          props: { options: ['一般', '较急', '紧急'] },
        },
      ],
    },
    {
      id: 'problem',
      type: 'section',
      title: '故障描述',
      bordered: true,
      children: [
        { id: 'tip', type: 'alert', props: { content: '描述得越具体，处理得越快。' } },
        {
          id: 'detail',
          type: 'textarea',
          name: 'detail',
          label: '现象',
          props: { placeholder: '什么时候开始、做了什么操作、出现了什么提示' },
        },
        { id: 'photos', type: 'upload', name: 'photos', label: '照片', help: '可以不传' },
      ],
    },
  ],
}))
</script>

<template>
  <DouSegmentedControl
    v-model="layout"
    :options="[
      { value: 'vertical', label: '标签在上' },
      { value: 'horizontal', label: '标签在左' },
    ]"
    size="sm"
    style="align-self: flex-start; margin-bottom: 16px"
  />
  <DouFormRenderer :form="form" />
</template>
