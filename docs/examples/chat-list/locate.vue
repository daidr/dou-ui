<script setup>
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'

const lines = [
  '上海门店下周的排班表发我看看？',
  '好的，周一到周五每天两班，周末三班，节假日另外安排。',
  '周三晚班人手不够，能从静安店借一个人吗？',
  '可以，戴兜那天休息，我问问他愿不愿意调班。',
]
const messages = Array.from({ length: 40 }, (_, index) => ({
  id: index,
  sender: index % 2 === 0 ? 'user' : 'assistant',
  text: lines[index % lines.length],
}))

const list = useTemplateRef('list')
const highlighted = ref(null)
let timer

// 比如项目内搜索点中了第 6 条：滚过去，短暂高亮
function locate(id) {
  list.value.scrollToMessage(id)
  highlighted.value = id
  clearTimeout(timer)
  timer = setTimeout(() => (highlighted.value = null), 1600)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <DouSpace>
    <DouButton size="sm" variant="outline" @click="locate(6)">定位到第 7 条</DouButton>
    <DouButton size="sm" variant="outline" @click="locate(25)">定位到第 26 条</DouButton>
  </DouSpace>
  <DouChatList ref="list" class="list" :items="messages" item-key="id">
    <template #item="{ item }">
      <DouChatMessage
        :sender="item.sender"
        :content="`${item.id + 1}. ${item.text}`"
        :copyable="false"
        :highlighted="highlighted === item.id"
      />
    </template>
  </DouChatList>
</template>

<style scoped>
.list {
  height: 320px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}
</style>
