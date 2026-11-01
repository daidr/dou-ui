<script setup lang="ts">
import { applyCommentAction, type CommentAction, type CommentThread } from 'dou-ui'
import { computed, ref } from 'vue'

const me = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const hours = (n: number) => new Date(Date.now() - n * 3600 * 1000).toISOString()

const threads = ref<CommentThread[]>([
  {
    id: 't1',
    comments: [{ id: 'a', author: qing, body: '首页的配图需要换成新版。', createdAt: hours(26) }],
    resolved: { by: me, at: hours(2) },
  },
  {
    id: 't2',
    comments: [{ id: 'b', author: qing, body: '价格表里少了企业版。', createdAt: hours(5) }],
  },
])
const log = ref<string[]>([])
const showResolved = ref(false)
const shown = computed(() =>
  threads.value.filter((thread) => showResolved.value || !thread.resolved),
)

function onAction(action: CommentAction) {
  threads.value = applyCommentAction(threads.value, action)
  // 实际项目中在这里把 action 发给服务器
  log.value = [action.type, ...log.value].slice(0, 3)
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 12px; max-width: 360px">
    <DouCheckbox v-model="showResolved">显示已解决的讨论</DouCheckbox>
    <DouCard v-for="thread in shown" :key="thread.id">
      <DouCommentThread :thread="thread" :author="me" @action="onAction" />
    </DouCard>
    <DouText variant="tertiary" size="sm">最近的操作：{{ log.join('、') || '无' }}</DouText>
  </div>
</template>
