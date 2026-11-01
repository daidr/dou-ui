<script setup lang="ts">
import { DouFormRenderer, type FormDocument, type FormValidator } from '@dou-ui/form-builder'
import { DouButton } from 'dou-ui'

const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'account',
      type: 'input',
      name: 'account',
      label: '账号',
      required: true,
      help: '试试 daidr',
      rules: [
        { min: 4, max: 16, message: '4 到 16 个字符' },
        { pattern: '^[a-z][a-z0-9_]*$', message: '小写字母开头，只能有字母、数字和下划线' },
        { validator: 'accountFree', message: '这个账号已被占用', trigger: 'blur' },
      ],
    },
    {
      id: 'email',
      type: 'input',
      name: 'email',
      label: '邮箱',
      rules: [{ type: 'email', trigger: 'blur' }],
    },
    {
      id: 'seats',
      type: 'input-number',
      name: 'seats',
      label: '人数',
      required: true,
      rules: [{ min: 1, max: 20, message: '1 到 20 人' }],
    },
  ],
}

// 描述里只写名字，函数由使用表单的代码提供
const taken = ['daidr', 'admin']
const validators: Record<string, FormValidator> = {
  async accountFree(value) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return !taken.includes(value as string)
  },
}
</script>

<template>
  <DouFormRenderer :form="form" :validators="validators" style="max-width: 440px">
    <div>
      <DouButton native-type="submit" tone="primary">创建</DouButton>
    </div>
  </DouFormRenderer>
</template>
