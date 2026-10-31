<script setup lang="ts">
import { ref } from 'vue'
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouButton, DouSwitch } from 'dou-ui'

// 先选笔记本并填写系统，再换成显示器：默认提交的值里没有 os
const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'kind',
      type: 'segmented-control',
      name: 'kind',
      label: '设备',
      default: 'laptop',
      props: {
        options: [
          { label: '笔记本', value: 'laptop' },
          { label: '显示器', value: 'monitor' },
        ],
      },
    },
    {
      id: 'os',
      type: 'input',
      name: 'os',
      label: '系统',
      default: 'macOS',
      visibleWhen: "values.kind == 'laptop'",
    },
    {
      id: 'size',
      type: 'input-number',
      name: 'size',
      label: '尺寸（英寸）',
      default: 27,
      visibleWhen: "values.kind == 'monitor'",
    },
  ],
}

const keepHidden = ref(false)
const sent = ref('')
</script>

<template>
  <DouFormRenderer
    :form="form"
    :keep-hidden="keepHidden"
    style="max-width: 440px"
    @submit="sent = JSON.stringify($event)"
  >
    <div style="display: flex; gap: 12px; align-items: center">
      <DouButton native-type="submit" tone="primary">提交</DouButton>
      <DouSwitch v-model="keepHidden">提交隐藏字段的值</DouSwitch>
    </div>
  </DouFormRenderer>
  <pre v-if="sent" style="margin: 12px 0 0; font-size: 12px">{{ sent }}</pre>
</template>
