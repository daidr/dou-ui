<script setup lang="ts">
import { ref } from 'vue'
import { DouFormBuilder, type FormDocument } from '@dou-ui/form-builder'

const form = ref<FormDocument>({
  version: 1,
  nodes: [
    {
      id: 'contact',
      type: 'section',
      title: '联系人',
      children: [
        { id: 'name', type: 'input', name: 'name', label: '姓名', required: true, span: 6 },
        {
          id: 'phone',
          type: 'input',
          name: 'phone',
          label: '手机号',
          span: 6,
          rules: [{ validator: 'phoneFree', message: '这个手机号已经报过名了' }],
        },
      ],
    },
    {
      id: 'city',
      type: 'select',
      name: 'city',
      label: '参加城市',
      default: 'sh',
      props: {
        options: [
          { label: '上海', value: 'sh' },
          { label: '杭州', value: 'hz' },
          { label: '成都', value: 'cd' },
        ],
      },
    },
    {
      id: 'parking',
      type: 'switch',
      name: 'parking',
      label: '需要停车位',
      visibleWhen: "values.city == 'sh'",
    },
    { id: 'note', type: 'textarea', name: 'note', label: '备注', help: '选填，会转给活动负责人' },
  ],
})
const selection = ref<string[]>(['phone'])
const validators = { phoneFree: () => true }
</script>

<template>
  <DouFormBuilder v-model="form" v-model:selection="selection" :validators="validators" readonly />
</template>
