<script setup lang="ts">
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouButton } from 'dou-ui'

// 每个标签页的字段都会在提交时检查，出错时切到第一个错误所在的页
const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'tabs',
      type: 'tabs',
      children: [
        {
          id: 'basic',
          type: 'page',
          title: '基本信息',
          children: [
            {
              id: 'name',
              type: 'input',
              name: 'name',
              label: '姓名',
              required: true,
              default: '戴兜',
            },
            {
              id: 'phone',
              type: 'input',
              name: 'phone',
              label: '手机号',
              required: true,
              default: '13800001234',
            },
          ],
        },
        {
          id: 'address',
          type: 'page',
          title: '收货地址',
          children: [
            {
              id: 'city',
              type: 'input',
              name: 'city',
              label: '城市',
              default: '上海',
              span: { sm: 6 },
            },
            { id: 'zip', type: 'input', name: 'zip', label: '邮编', span: { sm: 6 } },
            { id: 'street', type: 'textarea', name: 'street', label: '详细地址', required: true },
          ],
        },
      ],
    },
  ],
}
</script>

<template>
  <DouFormRenderer :form="form" style="max-width: 440px">
    <div>
      <DouButton native-type="submit" tone="primary">保存</DouButton>
    </div>
  </DouFormRenderer>
</template>
