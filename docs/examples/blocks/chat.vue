<script setup>
import {
  CodeIcon,
  EditIcon,
  MailIcon,
  MapIcon,
  MessagePlusIcon,
  MoreHorizontalIcon,
  PenSparkleIcon,
  SidebarIcon,
  TrashIcon,
} from '@dou-ui/icons'
import { dialog } from 'dou-ui'
import { computed, nextTick, onBeforeUnmount, reactive, ref, useTemplateRef } from 'vue'

// 示例数据
let nextId = 4
const conversations = ref([
  {
    id: 3,
    title: '周末骑行路线',
    messages: [
      {
        id: 1,
        sender: 'user',
        parts: [{ type: 'text', text: '周六想在徐汇滨江骑车，有推荐的路线吗？' }],
      },
      {
        id: 2,
        sender: 'assistant',
        parts: [
          {
            type: 'text',
            text: '可以从龙美术馆出发，沿滨江绿道向南骑到前滩休闲公园，单程约 8 公里，路面平整，适合轻松骑行。中午可以在西岸梦中心吃饭，下午原路返回。',
          },
        ],
      },
    ],
  },
  {
    id: 2,
    title: '项目周报',
    messages: [
      { id: 1, sender: 'user', parts: [{ type: 'text', text: '帮我把这周的进度整理成周报。' }] },
      {
        id: 2,
        sender: 'assistant',
        parts: [
          {
            type: 'text',
            text: '好的。请把这周完成的事项、遇到的问题和下周计划发给我，我按这三部分整理。',
          },
        ],
      },
    ],
  },
  { id: 1, title: '解释防抖函数', messages: [] },
])
const currentId = ref(3)
const current = computed(() => conversations.value.find((item) => item.id === currentId.value))

/* 会话 */
const drawerOpen = ref(false)

function choose(id) {
  stop()
  currentId.value = id
  drawerOpen.value = false
}

function create() {
  const blank = conversations.value.find((item) => !item.messages.length)
  if (blank) return choose(blank.id)
  conversations.value.unshift({ id: nextId++, title: '新对话', messages: [] })
  choose(conversations.value[0].id)
}

async function onAction(action, item) {
  if (action === 'rename') {
    const title = await dialog.prompt({ title: '重命名对话', defaultValue: item.title })
    if (title?.trim()) item.title = title.trim()
    return
  }
  const ok = await dialog.confirm({
    title: '删除对话？',
    content: `“${item.title}”的全部消息都会被删除。`,
    tone: 'danger',
    confirmText: '删除',
  })
  if (!ok) return
  conversations.value = conversations.value.filter((other) => other.id !== item.id)
  if (!conversations.value.length) create()
  else if (currentId.value === item.id) choose(conversations.value[0].id)
}

/* 发送与模拟回复 */
const text = ref('')
const loading = ref(false)
const list = useTemplateRef('list')
let timer

const suggestions = [
  { label: '写邮件', description: '给团队发一封项目进度更新', icon: MailIcon },
  { label: '规划行程', description: '安排一个上海周末一日游', icon: MapIcon },
  { label: '解释代码', description: '逐行说明一段函数在做什么', icon: CodeIcon },
  { label: '润色文字', description: '让一段话读起来更通顺', icon: PenSparkleIcon },
]

function send(value) {
  const conversation = current.value
  if (!conversation.messages.length) conversation.title = value.slice(0, 12)
  conversation.messages.push({
    id: Date.now(),
    sender: 'user',
    parts: [{ type: 'text', text: value }],
  })
  text.value = ''
  loading.value = true
  void nextTick(() => list.value?.scrollToBottom())

  const reply = reactive({ id: Date.now() + 1, sender: 'assistant', pending: true, parts: [] })
  conversation.messages.push(reply)
  const full = `收到。关于“${value}”，我先列出要点，再逐条展开说明。这是一段模拟的回复，用来展示流式输出时消息列表和输入框的状态。`
  timer = setTimeout(() => {
    reply.pending = false
    const part = reactive({ type: 'text', text: '', streaming: true })
    reply.parts.push(part)
    let index = 0
    timer = setInterval(() => {
      index += 2
      part.text = full.slice(0, index)
      if (index >= full.length) finish()
    }, 50)
  }, 700)
}

function finish() {
  clearTimeout(timer)
  clearInterval(timer)
  const reply = current.value?.messages.at(-1)
  if (reply?.sender === 'assistant') {
    reply.pending = false
    for (const part of reply.parts) part.streaming = false
  }
  loading.value = false
}

function stop() {
  if (loading.value) finish()
}
onBeforeUnmount(stop)
</script>

<template>
  <div class="chat-page">
    <div class="chat-page__layout">
      <aside class="chat-page__side">
        <DouButton variant="outline" block @click="create">
          <template #leading><MessagePlusIcon /></template>
          新对话
        </DouButton>
        <nav class="chat-page__history" aria-label="对话记录">
          <div
            v-for="item in conversations"
            :key="item.id"
            class="chat-page__item"
            :class="{ 'is-current': item.id === currentId }"
          >
            <button
              type="button"
              class="chat-page__title"
              :aria-current="item.id === currentId ? 'page' : undefined"
              @click="choose(item.id)"
            >
              {{ item.title }}
            </button>
            <DouDropdown placement="bottom-end" @select="onAction($event, item)">
              <DouButton variant="ghost" size="sm" :aria-label="`${item.title} 的更多操作`">
                <MoreHorizontalIcon />
              </DouButton>
              <template #menu>
                <DouDropdownItem value="rename">
                  <template #prefix
                    ><DouIcon><EditIcon /></DouIcon
                  ></template>
                  重命名
                </DouDropdownItem>
                <DouDropdownItem value="delete" tone="danger">
                  <template #prefix
                    ><DouIcon><TrashIcon /></DouIcon
                  ></template>
                  删除
                </DouDropdownItem>
              </template>
            </DouDropdown>
          </div>
        </nav>
      </aside>

      <main class="chat-page__main">
        <header class="chat-page__header">
          <DouButton
            class="chat-page__menu"
            variant="ghost"
            size="sm"
            aria-label="对话记录"
            @click="drawerOpen = true"
          >
            <SidebarIcon />
          </DouButton>
          <DouText weight="medium" class="chat-page__heading">{{ current.title }}</DouText>
        </header>

        <div v-if="!current.messages.length" class="chat-page__welcome">
          <h3>戴兜，今天想做点什么？</h3>
          <DouChatInput v-model="text" :loading="loading" @submit="send" @stop="stop" />
          <DouChatSuggestions
            variant="card"
            :columns="2"
            :items="suggestions"
            @select="text = $event"
          />
        </div>
        <template v-else>
          <DouChatList ref="list" class="chat-page__list">
            <DouChatMessage
              v-for="message in current.messages"
              :key="message.id"
              :sender="message.sender"
              :parts="message.parts"
              :pending="message.pending"
            />
          </DouChatList>
          <DouChatInput
            v-model="text"
            class="chat-page__input"
            placeholder="继续提问"
            :loading="loading"
            @submit="send"
            @stop="stop"
          />
        </template>
      </main>
    </div>

    <DouDrawer v-model:open="drawerOpen" placement="left" size="280px" title="对话记录">
      <div class="chat-page__drawer">
        <DouButton variant="outline" block @click="create">
          <template #leading><MessagePlusIcon /></template>
          新对话
        </DouButton>
        <button
          v-for="item in conversations"
          :key="item.id"
          type="button"
          class="chat-page__title chat-page__item"
          :class="{ 'is-current': item.id === currentId }"
          @click="choose(item.id)"
        >
          {{ item.title }}
        </button>
      </div>
    </DouDrawer>
  </div>
</template>

<style scoped>
.chat-page {
  width: 100%;
  box-sizing: border-box;
  height: 600px;
  overflow: hidden;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-canvas);
  container-type: inline-size;
}

.chat-page__layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  height: 100%;
}

.chat-page__side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 12px;
  border-right: 1px solid var(--dou-color-border);
  background-color: var(--dou-color-bg-surface);
}

.chat-page__history {
  display: grid;
  align-content: start;
  gap: 2px;
  min-height: 0;
  overflow-y: auto;
}

.chat-page__item {
  display: flex;
  align-items: center;
  border-radius: var(--dou-radius-control);
}

.chat-page__item:hover,
.chat-page__item.is-current {
  background-color: var(--dou-color-bg-muted);
}

.chat-page__item > .dou-button {
  opacity: 0;
}

.chat-page__item:hover > .dou-button,
.chat-page__item:focus-within > .dou-button,
.chat-page__item > .dou-button[aria-expanded='true'],
.chat-page__item.is-current > .dou-button {
  opacity: 1;
}

.chat-page__title {
  flex: 1 1 auto;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  overflow-x: clip;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--dou-font-size-sm);
  text-align: start;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  border-radius: var(--dou-radius-control);
}

.chat-page__title:focus-visible {
  outline: 2px solid var(--dou-color-focus);
  outline-offset: -2px;
}

.chat-page__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.chat-page__header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--dou-color-border);
}

.chat-page__menu {
  display: none;
}

.chat-page__heading {
  min-width: 0;
  overflow-x: clip;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-page__list {
  flex: 1 1 auto;
}

.chat-page__input {
  flex: none;
  width: auto;
  margin: 0 16px 16px;
}

.chat-page__welcome {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  flex: 1 1 auto;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box;
  overflow-y: auto;
}

.chat-page__welcome h3 {
  margin: 0;
  font-size: 20px;
  font-weight: var(--dou-font-weight-bold);
  text-align: center;
}

.chat-page__drawer {
  display: grid;
  gap: 2px;
}

.chat-page__drawer > .dou-button {
  margin-bottom: 10px;
}

@container (max-width: 640px) {
  .chat-page__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .chat-page__side {
    display: none;
  }

  .chat-page__menu {
    display: inline-flex;
  }
}
</style>
