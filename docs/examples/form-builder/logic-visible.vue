<script setup lang="ts">
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouButton } from 'dou-ui'

// 选“笔记本电脑”才出现“系统”；勾上发票后“抬头”变成必填；上门取件时“送修地址”不可填
const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'kind',
      type: 'segmented-control',
      name: 'kind',
      label: '设备类型',
      props: {
        options: [
          { value: 'laptop', label: '笔记本电脑' },
          { value: 'monitor', label: '显示器' },
          { value: 'other', label: '其他' },
        ],
      },
    },
    {
      id: 'os',
      type: 'radio-group',
      name: 'os',
      label: '系统',
      visibleWhen: "values.kind == 'laptop'",
      required: true,
      props: { options: ['Windows', 'macOS', 'Linux'] },
    },
    {
      id: 'other',
      type: 'input',
      name: 'other',
      label: '设备名称',
      visibleWhen: "values.kind == 'other'",
      required: true,
    },
    { id: 'pickup', type: 'switch', name: 'pickup', label: '上门取件', span: 6 },
    { id: 'invoice', type: 'switch', name: 'invoice', label: '需要发票', span: 6 },
    {
      id: 'address',
      type: 'input',
      name: 'address',
      label: '送修地址',
      disabledWhen: 'values.pickup',
      props: { placeholder: '上海市徐汇区漕溪北路 88 号' },
    },
    {
      id: 'title',
      type: 'input',
      name: 'title',
      label: '发票抬头',
      requiredWhen: 'values.invoice',
    },
  ],
}
</script>

<template>
  <DouFormRenderer :form="form" style="max-width: 440px">
    <div>
      <DouButton native-type="submit" tone="primary">提交</DouButton>
    </div>
  </DouFormRenderer>
</template>
