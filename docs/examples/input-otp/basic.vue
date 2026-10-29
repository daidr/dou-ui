<script setup>
import { ref } from 'vue'

const code = ref('')
const done = ref('')
</script>

<template>
  <DouInputOtp v-model="code" @complete="(value) => (done = value)" />
  <DouText size="sm" variant="tertiary">
    已输入：{{ code || '—' }}　完成：{{ done || '—' }}
  </DouText>
</template>
