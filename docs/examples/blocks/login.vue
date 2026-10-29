<script setup>
import { GithubIcon, LockIcon, MailIcon } from '@dou-ui/icons'
import { toast } from 'dou-ui'
import { reactive, ref } from 'vue'

const model = reactive({ email: '', password: '', remember: true })
const rules = {
  email: [{ required: true, message: '请填写邮箱' }, { type: 'email' }],
  password: [
    { required: true, message: '请填写密码' },
    { min: 8, message: '密码至少 8 位' },
  ],
}
const loading = ref(false)

function onSubmit() {
  loading.value = true
  setTimeout(() => {
    loading.value = false
    toast.success(`欢迎回来，${model.email}`)
  }, 800)
}
</script>

<template>
  <div class="login">
    <div class="login__panel">
      <div class="login__head">
        <DouText size="lg" weight="bold">登录到控制台</DouText>
        <DouText variant="secondary" size="sm">使用工作邮箱登录，管理你的服务与部署。</DouText>
      </div>

      <DouForm :model="model" :rules="rules" @submit="onSubmit">
        <DouFormItem label="邮箱" prop="email">
          <DouInput
            v-model="model.email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
          >
            <template #prefix><MailIcon /></template>
          </DouInput>
        </DouFormItem>
        <DouFormItem label="密码" prop="password">
          <DouInput
            v-model="model.password"
            type="password"
            show-password
            autocomplete="current-password"
          >
            <template #prefix><LockIcon /></template>
          </DouInput>
        </DouFormItem>
        <div class="login__row">
          <DouCheckbox v-model="model.remember">30 天内自动登录</DouCheckbox>
          <DouText size="sm"><DouLink href="#">忘记密码？</DouLink></DouText>
        </div>
        <DouButton native-type="submit" tone="primary" block :loading="loading">登录</DouButton>
      </DouForm>

      <DouDivider class="login__or">或</DouDivider>
      <DouButton variant="outline" block>
        <template #leading><GithubIcon /></template>
        使用 GitHub 登录
      </DouButton>

      <DouText class="login__foot" variant="secondary" size="sm">
        还没有账号？<DouLink href="#">注册</DouLink>
      </DouText>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  place-items: center;
  width: 100%;
  padding: 48px 16px;
  box-sizing: border-box;
}
.login__panel {
  display: grid;
  gap: 20px;
  width: 100%;
  max-width: 360px;
  padding: 32px;
  box-sizing: border-box;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-md);
}
.login__head {
  display: grid;
  gap: 6px;
}
.login__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -4px 0 8px;
}
.login__or {
  margin-block: 0;
}
.login__foot {
  text-align: center;
}
</style>
