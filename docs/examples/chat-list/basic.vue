<script setup>
import { SparklesIcon } from '@dou-ui/icons'
import { onBeforeUnmount, ref } from 'vue'

const messages = ref([
  { id: 1, mine: true, text: '帮我列一下这周要做的事。' },
  {
    id: 2,
    mine: false,
    text: '好的。你上周提到了组件库发版、周五的分享，还有给新同事准备入门文档。',
  },
  { id: 3, mine: true, text: '再加上整理报销单。' },
  { id: 4, mine: false, text: '已加上。按截止时间排，报销单周三前交，分享在周五下午。' },
])
const streaming = ref(false)
let timer
let id = 5

function append() {
  messages.value.push({ id: id++, mine: true, text: '还有别的建议吗？' })
  messages.value.push({ id: id++, mine: false, text: '' })
  const full =
    '可以每天早上花五分钟看一遍清单，把最难的一件放在上午做。分享的幻灯片周四晚上先过一遍，留出改的时间。入门文档可以请新同事边读边标出看不懂的地方，比你自己检查更有效。'
  const target = messages.value.at(-1)
  streaming.value = true
  let index = 0
  clearInterval(timer)
  timer = setInterval(() => {
    index += 5
    target.text = full.slice(0, index)
    if (index >= full.length) {
      clearInterval(timer)
      streaming.value = false
    }
  }, 120)
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <DouChatList class="list">
    <DouChatBubble
      v-for="message in messages"
      :key="message.id"
      :placement="message.mine ? 'end' : 'start'"
      :variant="message.mine ? 'soft' : 'ghost'"
    >
      <template v-if="!message.mine" #avatar>
        <DouAvatar><SparklesIcon /></DouAvatar>
      </template>
      <DouStreamText
        v-if="!message.mine"
        :content="message.text"
        :streaming="streaming && message === messages.at(-1)"
      />
      <template v-else>{{ message.text }}</template>
    </DouChatBubble>
  </DouChatList>
  <div>
    <DouButton size="sm" :disabled="streaming" @click="append">追加一轮对话</DouButton>
  </div>
</template>

<style scoped>
.list {
  height: 320px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}
</style>
