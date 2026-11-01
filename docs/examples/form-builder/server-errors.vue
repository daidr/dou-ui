<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { DouButton } from 'dou-ui'

const form: FormDocument = {
  version: 1,
  nodes: [
    { id: 'name', type: 'input', name: 'name', label: '团队名称', required: true },
    {
      id: 'slug',
      type: 'input',
      name: 'slug',
      label: '团队地址',
      required: true,
      help: '试试 douui',
    },
  ],
}

const renderer = useTemplateRef('renderer')
const saving = ref(false)

// 模拟服务端：保存时才发现地址已被占用
async function onSubmit(values: Record<string, unknown>) {
  saving.value = true
  await new Promise((resolve) => setTimeout(resolve, 400))
  saving.value = false
  if (values.slug === 'douui') renderer.value?.setErrors({ slug: '这个地址已被占用' })
}
</script>

<template>
  <DouFormRenderer ref="renderer" :form="form" style="max-width: 440px" @submit="onSubmit">
    <div>
      <DouButton native-type="submit" tone="primary" :loading="saving">创建团队</DouButton>
    </div>
  </DouFormRenderer>
</template>
