<script setup>
import { ref } from 'vue'

const code = ref('DOU-SH-2026')
const secret = ref('sk-shanghai-0001')
</script>

<template>
  <DouInput v-model="code" readonly style="width: 240px">
    <template #suffix>
      <DouButton variant="ghost">复制</DouButton>
    </template>
  </DouInput>
  <DouInput v-model="secret" type="password" show-password size="sm" style="width: 240px">
    <template #suffix>
      <DouButton variant="ghost" size="sm" @click="secret = ''">清除</DouButton>
    </template>
  </DouInput>
</template>
