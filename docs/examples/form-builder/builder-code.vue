<script setup lang="ts">
import { ref } from 'vue'
import { DouFormBuilder, type FormDocument } from '@dou-ui/form-builder'
import { codeExpressions } from '@dou-ui/form-builder/code'

// “合计”的公式用代码输入框编辑：输入 values. 补全字段，输入 round( 显示参数提示
const form = ref<FormDocument>({
  version: 1,
  nodes: [
    { id: 'buyer', type: 'input', name: 'buyer', label: '下单人', default: '戴兜' },
    { id: 'price', type: 'number', name: 'price', label: '单价', default: 128 },
    { id: 'count', type: 'number', name: 'count', label: '数量', default: 2 },
    {
      id: 'total',
      type: 'number',
      name: 'total',
      label: '合计',
      formula: 'round(values.price * values.count * 0.95, 2)',
      props: { disabled: true },
    },
  ],
})
const selection = ref<string[]>(['total'])
const extensions = [codeExpressions()]
</script>

<template>
  <DouFormBuilder v-model="form" v-model:selection="selection" :extensions="extensions" />
</template>
