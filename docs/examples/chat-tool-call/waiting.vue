<script setup>
import { ref } from 'vue'

const status = ref('waiting')
</script>

<template>
  <DouChatToolCall
    name="send_email"
    :status="status"
    :input="{ to: '戴兜', subject: '周末骑行', body: '周六上午九点，西岸美术馆门口见。' }"
    :output="status === 'done' ? '已发送' : status === 'error' ? '已拒绝' : undefined"
  >
    <template v-if="status === 'waiting'" #actions>
      <DouButton size="sm" @click="status = 'done'">允许</DouButton>
      <DouButton size="sm" variant="outline" @click="status = 'error'">拒绝</DouButton>
    </template>
  </DouChatToolCall>
  <div v-if="status !== 'waiting'">
    <DouButton size="sm" variant="ghost" @click="status = 'waiting'">重置</DouButton>
  </div>
</template>
