<script setup lang="ts">
import { reactive, ref } from 'vue'
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouSwitch } from 'dou-ui'

const form: FormDocument = {
  version: 1,
  layout: 'horizontal',
  nodes: [
    { id: 'applicant', type: 'input', name: 'applicant', label: '申请人', span: { md: 6 } },
    {
      id: 'city',
      type: 'select',
      name: 'city',
      label: '出差城市',
      span: { md: 6 },
      props: {
        options: [
          { value: 'sh', label: '上海' },
          { value: 'bj', label: '北京' },
          { value: 'sz', label: '深圳' },
        ],
      },
    },
    {
      id: 'dates',
      type: 'date-picker',
      name: 'dates',
      label: '出差日期',
      props: { range: true },
    },
    {
      id: 'transport',
      type: 'checkbox-group',
      name: 'transport',
      label: '交通方式',
      props: {
        options: [
          { value: 'train', label: '高铁' },
          { value: 'plane', label: '飞机' },
          { value: 'taxi', label: '打车' },
        ],
      },
    },
    {
      id: 'items',
      type: 'list',
      name: 'items',
      label: '费用明细',
      children: [
        { id: 'what', type: 'input', name: 'what', label: '项目', span: { sm: 8 } },
        {
          id: 'amount',
          type: 'input-number',
          name: 'amount',
          label: '金额',
          span: { sm: 4 },
          props: { precision: 2 },
        },
      ],
    },
    {
      id: 'total',
      type: 'input-number',
      name: 'total',
      label: '合计',
      formula: "sum(values.items, 'amount')",
      props: { precision: 2 },
    },
    { id: 'invoice', type: 'switch', name: 'invoice', label: '已附发票' },
    { id: 'note', type: 'textarea', name: 'note', label: '备注', help: '写明出差事由' },
  ],
}

const model = reactive({
  applicant: '戴兜',
  city: 'sh',
  dates: ['2026-11-03', '2026-11-05'],
  transport: ['train', 'taxi'],
  items: [
    { what: '往返高铁', amount: 1106 },
    { what: '住宿两晚', amount: 960 },
  ],
  invoice: true,
  note: '',
})

const readonly = ref(true)
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px; max-width: 560px">
    <label style="display: flex; align-items: center; gap: 8px">
      <DouSwitch v-model="readonly" />
      只读
    </label>
    <DouFormRenderer :form="form" :model="model" :readonly="readonly" />
  </div>
</template>
