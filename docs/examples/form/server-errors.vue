<script setup>
import { reactive, ref, useTemplateRef } from 'vue'

const site = reactive({ name: '', domain: '' })
const rules = {
  name: { required: true },
  domain: [{ required: true }, { pattern: /^[a-z0-9-]+$/, message: '只能用小写字母、数字和 -' }],
}
const form = useTemplateRef('form')
const saving = ref(false)

// 模拟服务端：校验通过之后，才知道域名已被占用
function save(model) {
  return new Promise((resolve) =>
    setTimeout(
      () => resolve(model.domain === 'douui' ? { domain: '这个域名已被占用' } : null),
      400,
    ),
  )
}

async function onSubmit(model) {
  saving.value = true
  const errors = await save(model)
  saving.value = false
  if (errors) form.value.setErrors(errors)
}
</script>

<template>
  <DouForm ref="form" :model="site" :rules="rules" @submit="onSubmit">
    <DouFormItem label="站点名称" prop="name">
      <DouInput v-model="site.name" />
    </DouFormItem>
    <DouFormItem label="域名" prop="domain" help="试试 douui">
      <DouInput v-model="site.domain">
        <template #suffix>.ui.daidr.me</template>
      </DouInput>
    </DouFormItem>
    <DouFormItem>
      <DouButton native-type="submit" :loading="saving">创建站点</DouButton>
    </DouFormItem>
  </DouForm>
</template>
