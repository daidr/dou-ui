<script setup>
import { SparklesIcon } from '@dou-ui/icons'
</script>

<template>
  <DouChatBubble placement="end" name="戴兜" avatar content="上海明天适合出去骑车吗？" />
  <DouChatBubble
    name="助手"
    content="明天上海多云，18 到 24 度，风力 2 级，下午五点后有小雨。建议上午出门，带一件薄外套。"
  >
    <template #avatar>
      <DouAvatar><SparklesIcon /></DouAvatar>
    </template>
  </DouChatBubble>
</template>
