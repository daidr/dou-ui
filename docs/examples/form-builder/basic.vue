<script setup lang="ts">
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouButton, DouSpace, DouText } from 'dou-ui'
import { reactive, ref } from 'vue'

// 这份描述是普通数据，可以存进数据库，也可以由表单设计器生成
const document: FormDocument = {
  version: 1,
  nodes: [
    { id: 'name', type: 'input', name: 'name', label: '姓名', required: true },
    {
      id: 'phone',
      type: 'input',
      name: 'phone',
      label: '手机号',
      required: true,
      rules: [{ pattern: '^1\\d{10}$', message: '请输入 11 位手机号' }],
      props: { type: 'tel', placeholder: '用于接收入场通知' },
    },
    {
      id: 'city',
      type: 'select',
      name: 'city',
      label: '参加城市',
      default: '上海',
      props: { options: ['上海', '北京', '杭州', '成都'] },
    },
    {
      id: 'sessions',
      type: 'checkbox-group',
      name: 'sessions',
      label: '想听的分享',
      rules: [{ min: 1, message: '至少选一场' }],
      props: { options: ['设计系统', '性能优化', '无障碍'] },
    },
    { id: 'agree', type: 'checkbox', name: 'agree', props: { text: '同意主办方联系我' } },
  ],
}

const model = reactive({})
const submitted = ref('')
</script>

<template>
  <DouFormRenderer
    :document="document"
    :model="model"
    style="max-width: 440px"
    @submit="submitted = JSON.stringify($event, null, 2)"
  >
    <DouSpace>
      <DouButton native-type="submit" tone="primary">报名</DouButton>
      <DouButton native-type="reset" variant="ghost">重置</DouButton>
    </DouSpace>
  </DouFormRenderer>
  <DouText v-if="submitted" as="pre" size="sm" variant="secondary" mono>{{ submitted }}</DouText>
</template>
