<script setup>
import { onBeforeUnmount, ref } from 'vue'

const text = ref('写一段产品更新说明')
const loading = ref(false)
let timer

function send() {
  text.value = ''
  loading.value = true
  timer = setTimeout(() => (loading.value = false), 5000)
}

function stop() {
  clearTimeout(timer)
  loading.value = false
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <DouChatInput v-model="text" :loading="loading" @submit="send" @stop="stop" />
</template>
