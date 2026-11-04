<script setup>
import { ref } from 'vue'

const status = ref('waiting')
</script>

<template>
  <DouChatConfirm
    title="发送周报给戴兜？"
    description="将用你的邮箱发送本周的项目周报"
    :status="status"
    @decide="status = $event === 'deny' ? 'denied' : 'approved'"
  >
    <DouText size="sm" variant="secondary">收件人：戴兜 · 主题：上海项目周报</DouText>
  </DouChatConfirm>
  <div>
    <DouButton
      v-if="status === 'waiting'"
      size="sm"
      variant="outline"
      @click="status = 'withdrawn'"
    >
      停止生成
    </DouButton>
    <DouButton v-else size="sm" variant="ghost" @click="status = 'waiting'">重置</DouButton>
  </div>
</template>
