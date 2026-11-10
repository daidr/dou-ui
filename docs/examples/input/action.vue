<script setup>
import { ref } from 'vue'

const link = ref('https://ui.daidr.me/invite/shanghai-2026')
const phone = ref('')
const sent = ref(false)
</script>

<template>
  <DouInput v-model="link" readonly style="width: 320px">
    <template #suffix>
      <DouCopyButton :text="link" label="复制链接" />
    </template>
  </DouInput>
  <DouInput v-model="phone" placeholder="手机号" style="width: 320px">
    <template #suffix>
      <DouButton variant="ghost" :disabled="sent || !phone" @click="sent = true">
        {{ sent ? '已发送' : '发送验证码' }}
      </DouButton>
    </template>
  </DouInput>
</template>
