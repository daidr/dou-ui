<script setup lang="ts">
import { ref } from 'vue'
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouButton } from 'dou-ui'

// 点“下一步”时只检查当前这一步；插槽里的按钮出现在最后一步
const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'steps',
      type: 'steps',
      children: [
        {
          id: 'who',
          type: 'page',
          title: '报名人',
          children: [
            { id: 'name', type: 'input', name: 'name', label: '姓名', required: true },
            {
              id: 'phone',
              type: 'input',
              name: 'phone',
              label: '手机号',
              required: true,
              rules: [{ pattern: '^1\\d{10}$', message: '请输入 11 位手机号' }],
            },
          ],
        },
        {
          id: 'session',
          type: 'page',
          title: '场次',
          children: [
            {
              id: 'day',
              type: 'radio-group',
              name: 'day',
              label: '日期',
              required: true,
              props: { options: ['周六上午', '周六下午', '周日上午'] },
            },
            {
              id: 'seats',
              type: 'input-number',
              name: 'seats',
              label: '人数',
              default: 1,
              props: { min: 1, max: 4 },
            },
          ],
        },
        {
          id: 'confirm',
          type: 'page',
          title: '确认',
          description: '提交后会把确认短信发到报名时填写的手机号。',
          children: [
            { id: 'note', type: 'textarea', name: 'note', label: '备注' },
            {
              id: 'agree',
              type: 'checkbox',
              name: 'agree',
              required: true,
              props: { text: '我已阅读报名须知' },
            },
          ],
        },
      ],
    },
  ],
}

const sent = ref('')
</script>

<template>
  <DouFormRenderer :form="form" style="max-width: 440px" @submit="sent = JSON.stringify($event)">
    <DouButton native-type="submit" tone="primary">提交报名</DouButton>
  </DouFormRenderer>
  <pre v-if="sent" style="margin: 12px 0 0; font-size: 12px; white-space: pre-wrap">{{ sent }}</pre>
</template>
