<script setup>
import { SparklesIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const draft = ref('')
const messages = ref([
  { id: 1, mine: true, text: '帮我看下这周还有哪些待办。' },
  {
    id: 2,
    mine: false,
    text: '目前有三项：完成组件文档更新、核对发版说明，以及周五下午的分享材料。',
  },
  { id: 3, mine: true, text: '把组件文档放在最前面。' },
  {
    id: 4,
    mine: false,
    text: '已调整顺序。今天先完成组件文档与测试，明天核对发版说明，周四下午整理分享内容。',
  },
  { id: 5, mine: true, text: '好的，顺便提醒我留出回归测试时间。' },
  {
    id: 6,
    mine: false,
    text: '已记下，会在发版说明之后预留半天做回归验证，确保样式和交互都没有遗漏。',
  },
])

let nextId = 7
function send(text) {
  messages.value.push({ id: nextId++, mine: true, text })
  draft.value = ''
}
</script>

<template>
  <div class="stage">
    <DouChatList class="list" :bottom-inset="108" bottom-fade>
      <DouChatBubble
        v-for="message in messages"
        :key="message.id"
        :placement="message.mine ? 'end' : 'start'"
        :variant="message.mine ? 'soft' : 'ghost'"
      >
        <template v-if="!message.mine" #avatar>
          <DouAvatar><SparklesIcon /></DouAvatar>
        </template>
        {{ message.text }}
      </DouChatBubble>
    </DouChatList>
    <div class="composer">
      <DouChatInput v-model="draft" placeholder="输入消息..." @submit="send" />
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  height: 360px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-canvas);
  overflow: hidden;
}

.list {
  height: 100%;
}

.composer {
  position: absolute;
  inset-inline: 12px;
  inset-block-end: 12px;
}
</style>
