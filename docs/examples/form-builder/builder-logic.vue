<script setup lang="ts">
import { ref } from 'vue'
import { DouFormBuilder, type FormDocument } from '@dou-ui/form-builder'

// “系统”只在选了笔记本时显示；手机号带一条正则规则。选中节点后在属性面板的“校验”和“联动”里修改
const form = ref<FormDocument>({
  version: 1,
  nodes: [
    {
      id: 'device',
      type: 'radio-group',
      name: 'device',
      label: '设备类型',
      default: 'laptop',
      props: {
        options: [
          { label: '笔记本', value: 'laptop' },
          { label: '显示器', value: 'monitor' },
          { label: '打印机', value: 'printer' },
        ],
      },
    },
    {
      id: 'os',
      type: 'select',
      name: 'os',
      label: '系统',
      visibleWhen: "values.device == 'laptop'",
      props: { options: ['macOS', 'Windows', 'Linux'] },
    },
    {
      id: 'phone',
      type: 'input',
      name: 'phone',
      label: '联系电话',
      required: true,
      rules: [{ pattern: '^1\\d{10}$', message: '请填写 11 位手机号' }],
    },
  ],
})
const selection = ref<string[]>(['os'])
</script>

<template>
  <DouFormBuilder v-model="form" v-model:selection="selection" />
</template>
