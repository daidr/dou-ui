<script setup>
import { ref } from 'vue'

const common = ['👍', '❤️', '🎉', '😄', '👀', '🚀']
const reactions = ref([
  { emoji: '👍', count: 2, reacted: true, label: '你和戴兜' },
  { emoji: '🎉', count: 1, label: '戴兜' },
])
// 自己的消息上只显示别人的回应，自己不能回应
const mine = [{ emoji: '👀', count: 1, label: '助手' }]

// 点一下回应：没回应过就加一个，回应过就收回
function toggle(list, emoji) {
  const found = list.find((r) => r.emoji === emoji)
  if (!found) return [...list, { emoji, count: 1, reacted: true }]
  const count = found.count + (found.reacted ? -1 : 1)
  return list
    .map((r) => (r === found ? { ...r, count, reacted: !found.reacted, label: undefined } : r))
    .filter((r) => r.count > 0)
}
</script>

<template>
  <DouChatMessage
    sender="user"
    content="周六上午九点在世纪公园 7 号门集合，骑到滴水湖。"
    :reactions="mine"
    :reactable="false"
  />
  <DouChatMessage
    content="收到。上海周六多云，22–27°C，东南风 3 级，适合骑行。记得带水和防晒。"
    :reactions="reactions"
    @react="reactions = toggle(reactions, $event)"
  >
    <template #reaction-picker="{ react }">
      <div class="picker">
        <DouButton
          v-for="emoji in common"
          :key="emoji"
          variant="ghost"
          size="sm"
          :aria-label="`回应 ${emoji}`"
          @click="react(emoji)"
        >
          {{ emoji }}
        </DouButton>
      </div>
    </template>
  </DouChatMessage>
</template>

<style scoped>
.picker {
  display: flex;
  gap: 2px;
  margin: -4px;
}
</style>
