<script setup lang="ts">
import { reactive } from 'vue'
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouButton } from 'dou-ui'

// 每一项的小计用 item 读同一项的单价和数量，合计用 sum 按键求和
const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'items',
      type: 'list',
      name: 'items',
      label: '采购明细',
      min: 1,
      max: 5,
      addText: '添加一行',
      children: [
        { id: 'item-name', type: 'input', name: 'name', label: '物品', required: true },
        {
          id: 'item-price',
          type: 'input-number',
          name: 'price',
          label: '单价',
          span: { sm: 4 },
          props: { min: 0 },
        },
        {
          id: 'item-count',
          type: 'input-number',
          name: 'count',
          label: '数量',
          span: { sm: 4 },
          default: 1,
          props: { min: 1 },
        },
        {
          id: 'item-total',
          type: 'input-number',
          name: 'total',
          label: '小计',
          span: { sm: 4 },
          formula: 'item.price * item.count',
        },
      ],
    },
    {
      id: 'sum',
      type: 'input-number',
      name: 'sum',
      label: '合计',
      formula: "sum(values.items, 'total')",
    },
  ],
}

const model = reactive({
  items: [
    { name: '显示器', price: 1299, count: 2 },
    { name: '键盘', price: 349, count: 3 },
  ],
})
</script>

<template>
  <DouFormRenderer :form="form" :model="model" style="max-width: 480px">
    <div>
      <DouButton native-type="submit" tone="primary">提交</DouButton>
    </div>
  </DouFormRenderer>
</template>
