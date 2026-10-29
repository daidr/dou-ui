<script setup>
import { reactive, ref } from 'vue'

const account = reactive({ email: '', password: '', role: '', agree: false })
const rules = {
  email: [{ required: true }, { type: 'email' }],
  password: [{ required: true }, { min: 8 }],
  role: { required: true, message: '请选择一个角色' },
  agree: { required: true, message: '需要同意服务条款' },
}
const submitted = ref('')
function onSubmit(model) {
  submitted.value = JSON.stringify(model)
}
</script>

<template>
  <DouForm :model="account" :rules="rules" @submit="onSubmit">
    <DouFormItem label="邮箱" prop="email">
      <DouInput v-model="account.email" placeholder="you@example.com" />
    </DouFormItem>
    <DouFormItem label="密码" prop="password" help="至少 8 个字符">
      <DouInput v-model="account.password" type="password" />
    </DouFormItem>
    <DouFormItem label="角色" prop="role">
      <DouRadioGroup v-model="account.role">
        <DouRadio value="dev">开发</DouRadio>
        <DouRadio value="design">设计</DouRadio>
        <DouRadio value="pm">产品</DouRadio>
      </DouRadioGroup>
    </DouFormItem>
    <DouFormItem prop="agree">
      <DouCheckbox v-model="account.agree">我已阅读并同意服务条款</DouCheckbox>
    </DouFormItem>
    <DouFormItem>
      <DouButton native-type="submit">创建账号</DouButton>
      <DouButton native-type="reset" variant="ghost">重置</DouButton>
    </DouFormItem>
  </DouForm>
  <DouText v-if="submitted" variant="tertiary" size="sm" mono>{{ submitted }}</DouText>
</template>
