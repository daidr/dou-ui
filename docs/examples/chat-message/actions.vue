<script setup>
import { RefreshIcon, ThumbsDownIcon, ThumbsUpIcon } from '@dou-ui/icons'
import { computed, ref } from 'vue'

const question = ref('给周报起个标题')
const versions = ['本周进展：组件库第一版完成', '一周回顾：组件库按计划交付', '周报 · 10 月第 5 周']
const version = ref(3)
const answer = computed(() => versions[version.value - 1])
</script>

<template>
  <DouChatMessage sender="user" :content="question" editable @edit="question = $event" />
  <DouChatMessage v-model:version="version" :content="answer" :versions="versions.length">
    <template #actions>
      <DouButton variant="ghost" size="sm" aria-label="重新生成"><RefreshIcon /></DouButton>
      <DouButton variant="ghost" size="sm" aria-label="有帮助"><ThumbsUpIcon /></DouButton>
      <DouButton variant="ghost" size="sm" aria-label="没帮助"><ThumbsDownIcon /></DouButton>
    </template>
  </DouChatMessage>
</template>
