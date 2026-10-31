<script setup lang="ts">
import { ref } from 'vue'
import { DouFormBuilder, type FormDocument } from '@dou-ui/form-builder'

// 设计器通过 v-model 交出新的描述，每次修改都是一份新的对象
const form = ref<FormDocument>({
  version: 1,
  nodes: [
    {
      id: 'contact',
      type: 'section',
      title: '联系人',
      children: [
        { id: 'name', type: 'input', name: 'name', label: '姓名', required: true, span: 6 },
        { id: 'phone', type: 'input', name: 'phone', label: '手机号', span: 6 },
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
    { id: 'note', type: 'textarea', name: 'note', label: '备注', help: '选填，会转给活动负责人' },
  ],
})
const selection = ref<string[]>(['name'])
</script>

<template>
  <DouFormBuilder v-model="form" v-model:selection="selection" />
</template>
