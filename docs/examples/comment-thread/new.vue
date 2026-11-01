<script setup lang="ts">
import type { CommentThread } from 'dou-ui'
import { ref } from 'vue'

const me = { id: 'dai', name: '戴兜' }
const thread = ref<CommentThread | null>(null)
</script>

<template>
  <DouCard style="max-width: 360px">
    <DouCommentThread v-model:thread="thread" :author="me" placeholder="对这份方案有什么想法？" />
  </DouCard>
</template>
