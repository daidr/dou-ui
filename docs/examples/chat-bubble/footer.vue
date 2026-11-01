<script setup>
import { RefreshIcon, SparklesIcon, ThumbsDownIcon, ThumbsUpIcon } from '@dou-ui/icons'

const reply = '可以按"背景、目标、方案、排期"四段来写，每段两三句话，最后附上需要谁配合。'
</script>

<template>
  <DouChatBubble variant="ghost" :content="reply">
    <template #avatar>
      <DouAvatar><SparklesIcon /></DouAvatar>
    </template>
    <template #footer>
      <DouCopyButton :text="reply" />
      <DouTooltip content="重新生成">
        <DouButton variant="ghost" size="sm" aria-label="重新生成"><RefreshIcon /></DouButton>
      </DouTooltip>
      <DouButton variant="ghost" size="sm" aria-label="有帮助"><ThumbsUpIcon /></DouButton>
      <DouButton variant="ghost" size="sm" aria-label="没帮助"><ThumbsDownIcon /></DouButton>
    </template>
  </DouChatBubble>
</template>
