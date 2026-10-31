<script setup>
import { ref } from 'vue'

const lines = [
  '这周的发版清单整理好了吗？',
  '整理好了，一共十二项，其中三项还在等测试结果。',
  '上海那边的灰度从明天上午开始，先放百分之五的流量，观察半小时没有问题再继续扩大。',
]
const make = (from, count) =>
  Array.from({ length: count }, (_, index) => ({
    id: from + index,
    mine: (from + index) % 2 === 0,
    text: lines[Math.abs(from + index) % 3],
  }))

const messages = ref(make(0, 1000))
const loading = ref(false)

function loadEarlier() {
  if (loading.value) return
  loading.value = true
  setTimeout(() => {
    const first = messages.value[0].id
    messages.value = [...make(first - 50, 50), ...messages.value]
    loading.value = false
  }, 400)
}
</script>

<template>
  <DouChatList class="list" :items="messages" item-key="id" @top-reached="loadEarlier">
    <template #item="{ item }">
      <DouChatBubble
        :placement="item.mine ? 'end' : 'start'"
        :variant="item.mine ? 'soft' : 'ghost'"
      >
        {{ item.text }}
      </DouChatBubble>
    </template>
  </DouChatList>
  <DouText variant="tertiary" size="sm"
    >共 {{ messages.length }} 条，滚到顶部会加载更早的 50 条。</DouText
  >
</template>

<style scoped>
.list {
  height: 320px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}
</style>
