<script setup lang="ts">
import type { CommentThread } from 'dou-ui'
import { ref } from 'vue'

const me = { id: 'dai', name: '戴兜' }
const thread = ref<CommentThread | null>({
  id: 'launch',
  comments: [
    {
      id: 'c1',
      author: { id: 'qing', name: '阿青' },
      body: '上线时间定在周五晚上会不会太晚？\n客服那边周末只有一个人值班。',
      createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
    {
      id: 'c2',
      author: me,
      body: '可以提前到周四下午，我去和运营确认。',
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
  ],
})
</script>

<template>
  <DouCommentThread v-if="thread" v-model:thread="thread" :author="me" style="max-width: 360px" />
  <DouText v-else variant="tertiary">讨论已删除。</DouText>
</template>
