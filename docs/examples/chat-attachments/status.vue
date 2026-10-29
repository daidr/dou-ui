<script setup>
import { onBeforeUnmount, ref } from 'vue'

const files = ref([
  { uid: '1', name: '会议录音.m4a', size: 18_400_000, status: 'uploading', percent: 0 },
  { uid: '2', name: '原始数据.zip', size: 52_000_000, status: 'error' },
])

const timer = setInterval(() => {
  const file = files.value.find((item) => item.uid === '1')
  if (!file) return
  file.percent = file.percent >= 100 ? 0 : file.percent + 5
}, 300)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <DouChatAttachments v-model="files" />
</template>
