<script setup lang="ts">
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { reactive } from 'vue'

// 小计、优惠和应付由公式算出，单价、数量或会员等级一变就重新计算
const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'price',
      type: 'input-number',
      name: 'price',
      label: '单价',
      span: { sm: 6 },
      default: 128,
    },
    {
      id: 'count',
      type: 'input-number',
      name: 'count',
      label: '数量',
      span: { sm: 6 },
      default: 3,
    },
    {
      id: 'level',
      type: 'segmented-control',
      name: 'level',
      label: '会员等级',
      props: { options: ['普通', '银卡', '金卡'] },
    },
    {
      id: 'subtotal',
      type: 'input-number',
      name: 'subtotal',
      label: '小计',
      span: { sm: 4 },
      formula: 'values.price * values.count',
    },
    {
      id: 'discount',
      type: 'input-number',
      name: 'discount',
      label: '优惠',
      span: { sm: 4 },
      formula:
        "round(values.subtotal * (values.level == '金卡' ? 0.2 : values.level == '银卡' ? 0.1 : 0), 2)",
    },
    {
      id: 'total',
      type: 'input-number',
      name: 'total',
      label: '应付',
      span: { sm: 4 },
      formula: 'values.subtotal - values.discount',
    },
  ],
}

const model = reactive<Record<string, any>>({})
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 480px">
    <DouFormRenderer :form="form" :model="model" />
    <div style="color: var(--dou-color-text-secondary)">应付 {{ model.total }} 元</div>
  </div>
</template>
