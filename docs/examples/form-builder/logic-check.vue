<script setup lang="ts">
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouButton } from 'dou-ui'

// 离店日期和入住日期比较；改了入住日期，离店日期上的错误会立即重新检查
const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'checkin',
      type: 'date-picker',
      name: 'checkin',
      label: '入住',
      span: { sm: 6 },
      required: true,
      rules: [{ check: 'value >= today()', message: '不能早于今天' }],
    },
    {
      id: 'checkout',
      type: 'date-picker',
      name: 'checkout',
      label: '离店',
      span: { sm: 6 },
      required: true,
      rules: [{ check: 'days(values.checkin, value) >= 1', message: '至少住一晚' }],
    },
    {
      id: 'nights',
      type: 'input-number',
      name: 'nights',
      label: '晚数',
      span: { sm: 6 },
      formula: 'days(values.checkin, values.checkout)',
    },
    {
      id: 'guests',
      type: 'input-number',
      name: 'guests',
      label: '人数',
      span: { sm: 6 },
      default: 2,
      rules: [{ check: 'value <= 3 || values.extraBed', message: '超过 3 人需要加床' }],
    },
    { id: 'extraBed', type: 'checkbox', name: 'extraBed', props: { text: '加床' } },
  ],
}
</script>

<template>
  <DouFormRenderer :form="form" style="max-width: 440px">
    <div>
      <DouButton native-type="submit" tone="primary">预订</DouButton>
    </div>
  </DouFormRenderer>
</template>
