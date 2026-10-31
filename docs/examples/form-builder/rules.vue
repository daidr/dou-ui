<script setup lang="ts">
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouButton, type FormRules } from 'dou-ui'

const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'account',
      type: 'input',
      name: 'account',
      label: '账号',
      required: true,
      rules: [
        { min: 4, max: 16, message: '4 到 16 个字符' },
        { pattern: '^[a-z][a-z0-9_]*$', message: '小写字母开头，只能有字母、数字和下划线' },
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

// 需要写代码的检查放在 `rules` 里，和描述中的规则一起生效
const taken = ['daidr', 'admin']
const rules: FormRules = {
  account: {
    validator: async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return !taken.includes(value as string) || '这个账号已被占用'
    },
    trigger: 'blur',
  },
}
</script>

<template>
  <DouFormRenderer :form="form" :rules="rules" style="max-width: 440px">
    <div>
      <DouButton native-type="submit" tone="primary">创建</DouButton>
    </div>
  </DouFormRenderer>
</template>
