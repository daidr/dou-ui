<script setup>
import {
  ChevronDownIcon,
  CloseIcon,
  FileTextIcon,
  GlobeIcon,
  ListChecksIcon,
  PaperclipIcon,
  RefreshIcon,
  SearchIcon,
  TextSparkleIcon,
} from '@dou-ui/icons'
import { computed, nextTick, onBeforeUnmount, reactive, ref, useTemplateRef } from 'vue'

const sources = [
  {
    title: '上海未来七天天气预报',
    url: 'https://weather.example.com/shanghai',
    description: '周六多云，18 到 24 度，东北风 2 级；17 点后有小雨。',
  },
  {
    title: '徐汇滨江骑行路线推荐',
    url: 'https://ride.example.com/xuhui',
    description: '龙美术馆至前滩约 8 公里，全程有绿道。',
  },
  { title: '西岸梦中心周末活动', url: 'https://westbund.example.com/events' },
]

const plan = `# 周六骑行计划

- 09:00 龙美术馆集合
- 09:30 沿滨江向南，经过西岸美术馆
- 10:30 前滩休闲公园休息
- 11:30 西岸梦中心午饭
- 13:00 原路返回`

const messages = ref([
  {
    id: 1,
    sender: 'user',
    parts: [
      { type: 'files', files: [{ uid: 'f1', name: '上次骑行记录.gpx', size: 86_000 }] },
      { type: 'text', text: '帮我安排这周六的骑行，参考上次的路线。' },
    ],
  },
  {
    id: 2,
    sender: 'assistant',
    versions: 2,
    parts: [
      {
        type: 'steps',
        items: [
          { label: '读取文件', detail: '上次骑行记录.gpx', icon: FileTextIcon },
          { label: '搜索网页', detail: '上海 周六 天气', icon: SearchIcon },
          { label: '搜索网页', detail: '徐汇滨江 骑行路线', icon: SearchIcon },
          { label: '阅读 3 个网页', icon: GlobeIcon },
        ],
      },
      {
        type: 'plan',
        items: [
          { label: '查看周六天气', status: 'done' },
          { label: '对比上次路线', status: 'done' },
          { label: '整理行程', status: 'done' },
          { label: '通知同行的人', status: 'waiting' },
        ],
      },
      {
        type: 'text',
        text: '周六适合骑车：多云，18 到 24 度，风不大[1]。下午五点后可能下雨，建议上午出发。上次你骑的是龙美术馆到前滩这段，这次可以多走一段到西岸梦中心吃午饭[2]，全程约 16 公里。',
      },
      { type: 'sources', items: sources },
      {
        type: 'artifact',
        id: 'plan',
        title: '周六骑行计划.md',
        description: 'Markdown · 5 个时间点',
      },
      {
        type: 'confirm',
        id: 'mail',
        title: '发送邮件给 2 位同行的人？',
        description: '收件人：戴兜、骑行小组',
        detail: '主题：周六骑行\n周六上午九点，龙美术馆门口集合，全程约 16 公里。',
        status: 'waiting',
        allowAlways: true,
      },
    ],
  },
])

const text = ref('')
const loading = ref(false)
const model = ref('Dou 1.5')
const panel = ref(null)
const used = ref(48_600)
const list = useTemplateRef('list')
let timers = []

const commands = [
  { value: 'summarize', label: '总结', description: '概括对话要点', icon: TextSparkleIcon },
  { value: 'translate', label: '翻译', description: '翻译上一条回复', icon: GlobeIcon },
  { value: 'plan', label: '计划', description: '先列计划再动手', icon: ListChecksIcon },
]
const mentions = [
  { value: '上次骑行记录.gpx', description: '文件', icon: FileTextIcon },
  { value: '周六骑行计划.md', description: '产物', icon: FileTextIcon },
  { value: '戴兜', description: '成员' },
]

function renderText(value) {
  return value.split(/(\[\d+\])/).map((piece) => {
    const match = /^\[(\d+)\]$/.exec(piece)
    return match ? { index: Number(match[1]) } : { text: piece }
  })
}

function onConfirm(part, decision) {
  part.status = decision === 'deny' ? 'denied' : 'approved'
  const todo = messages.value[1].parts.find((p) => p.type === 'plan')
  if (todo) todo.items[3].status = decision === 'deny' ? 'skipped' : 'done'
}

// A new message or a stop means the assistant no longer waits for answers
// it asked for earlier: withdraw them, and skip the plan steps they held up.
function withdrawWaiting() {
  for (const message of messages.value) {
    for (const part of message.parts) {
      if (part.type === 'confirm' && part.status === 'waiting') part.status = 'withdrawn'
      if (part.type === 'plan') {
        for (const item of part.items) if (item.status === 'waiting') item.status = 'skipped'
      }
    }
  }
}

function later(fn, ms) {
  timers.push(setTimeout(fn, ms))
}

function send(value) {
  withdrawWaiting()
  messages.value.push({ id: Date.now(), sender: 'user', parts: [{ type: 'text', text: value }] })
  text.value = ''
  loading.value = true
  // a new question always brings the reader back to the end
  void nextTick(() => list.value?.scrollToBottom())
  const reply = reactive({ id: Date.now() + 1, sender: 'assistant', loading: true, parts: [] })
  messages.value.push(reply)
  const steps = reactive({ type: 'steps', items: [] })
  later(() => {
    reply.loading = false
    reply.parts.push(steps)
    steps.items.push({
      label: '搜索网页',
      detail: '西岸梦中心 午餐',
      icon: SearchIcon,
      status: 'running',
    })
  }, 600)
  later(() => {
    steps.items[0].status = 'done'
    steps.items.push({ label: '阅读 2 个网页', icon: GlobeIcon, status: 'running' })
  }, 1800)
  later(() => {
    steps.items[1].status = 'done'
    const part = reactive({ type: 'text', text: '', streaming: true })
    reply.parts.push(part)
    const full =
      '西岸梦中心附近有几家适合骑行后吃的店，人均 80 元左右，中午 11:30 前到基本不用排队[1]。建议提前在小程序上取号。'
    let index = 0
    const timer = setInterval(() => {
      index += 3
      part.text = full.slice(0, index)
      used.value += 120
      if (index >= full.length) {
        clearInterval(timer)
        part.streaming = false
        reply.parts.push({ type: 'sources', items: [sources[2]] })
        loading.value = false
      }
    }, 90)
    timers.push(timer)
  }, 3000)
}

function stop() {
  timers.forEach((timer) => (clearTimeout(timer), clearInterval(timer)))
  timers = []
  const reply = messages.value.at(-1)
  reply.loading = false
  for (const part of reply.parts) {
    if (part.streaming) part.streaming = false
    for (const step of part.items ?? []) if (step.status === 'running') step.status = 'done'
  }
  loading.value = false
  withdrawWaiting()
}

const panelOpen = computed(() => panel.value === 'plan')
onBeforeUnmount(stop)
</script>

<template>
  <div class="workbench" :class="{ 'has-panel': panelOpen }">
    <div class="chat">
      <DouChatList ref="list" class="list">
        <DouChatMessage
          v-for="message in messages"
          :key="message.id"
          :sender="message.sender"
          :parts="message.parts"
          :loading="message.loading"
          :versions="message.versions"
          :editable="message.sender === 'user'"
          @confirm="onConfirm"
          @artifact="panel = panel === 'plan' ? null : 'plan'"
        >
          <template #text="{ text: shown }">
            <template v-for="(piece, i) in renderText(shown)" :key="i">
              <DouChatCitation
                v-if="piece.index"
                :index="piece.index"
                :source="sources[piece.index - 1]"
              />
              <template v-else>{{ piece.text }}</template>
            </template>
          </template>
          <template v-if="message.sender === 'assistant'" #actions>
            <DouButton variant="ghost" size="sm" aria-label="重新生成"><RefreshIcon /></DouButton>
          </template>
        </DouChatMessage>
      </DouChatList>
      <DouChatInput
        v-model="text"
        class="input"
        placeholder="问点什么，/ 使用命令，@ 引用文件"
        :loading="loading"
        :commands="commands"
        :mentions="mentions"
        @submit="send"
        @stop="stop"
      >
        <template #actions>
          <DouButton variant="ghost" size="sm" aria-label="添加附件"><PaperclipIcon /></DouButton>
          <DouDropdown @select="(value) => (model = value)">
            <DouButton variant="ghost" size="sm">
              {{ model }}
              <template #trailing><ChevronDownIcon /></template>
            </DouButton>
            <template #menu>
              <DouDropdownItem value="Dou 1.5">Dou 1.5</DouDropdownItem>
              <DouDropdownItem value="Dou 1.5 mini">Dou 1.5 mini</DouDropdownItem>
            </template>
          </DouDropdown>
          <DouChatContextMeter :used="used" :total="200000" show-label />
        </template>
      </DouChatInput>
    </div>
    <aside v-if="panelOpen" class="panel">
      <header class="panel-header">
        <span>周六骑行计划.md</span>
        <DouButton variant="ghost" size="sm" aria-label="关闭" @click="panel = null">
          <CloseIcon />
        </DouButton>
      </header>
      <pre class="panel-body">{{ plan }}</pre>
    </aside>
  </div>
</template>

<style scoped>
.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  height: 640px;
  overflow: hidden;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-canvas);
}

.workbench.has-panel {
  grid-template-columns: minmax(0, 1fr) minmax(0, 300px);
}

.chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.list {
  flex: 1 1 auto;
}

.input {
  flex: none;
  width: auto;
  margin: 0 16px 16px;
}

.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid var(--dou-color-border);
  background-color: var(--dou-color-bg-surface);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 8px 16px;
  border-bottom: 1px solid var(--dou-color-border);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-medium);
}

.panel-body {
  flex: 1 1 auto;
  margin: 0;
  border-radius: 0;
  background: none;
  padding: 16px;
  overflow: auto;
  font-family: var(--dou-font-family-mono);
  font-size: 13px;
  line-height: 22px;
  white-space: pre-wrap;
}
</style>
