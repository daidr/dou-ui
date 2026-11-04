<script setup>
import { ref } from 'vue'

const tab = ref('profile')
const sections = [
  { value: 'profile', label: '个人资料' },
  { value: 'security', label: '账号安全' },
  { value: 'notify', label: '通知' },
  { value: 'appearance', label: '外观' },
  { value: 'language', label: '语言与地区' },
  { value: 'billing', label: '账单' },
  { value: 'members', label: '成员' },
  { value: 'integrations', label: '集成' },
  { value: 'api', label: 'API 密钥' },
  { value: 'logs', label: '审计日志' },
]
const rows = Array.from({ length: 12 }, (_, index) => index + 1)
</script>

<template>
  <DouTabs v-model="tab" placement="start" :height="280">
    <DouTabPanel
      v-for="section in sections"
      :key="section.value"
      :value="section.value"
      :label="section.label"
    >
      <p v-for="row in rows" :key="row" style="margin: 0 0 12px">
        {{ section.label }} · 第 {{ row }} 项设置
      </p>
    </DouTabPanel>
  </DouTabs>
</template>
