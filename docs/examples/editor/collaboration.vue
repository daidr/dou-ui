<script setup lang="ts">
import { DouEditor, editorKit } from '@dou-ui/editor'
import { collaboration, fillMap } from '@dou-ui/editor/collaboration'
import { DouSwitch, type CommentThread } from 'dou-ui'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'

// 示例里两个编辑器在同一个页面，用函数代替服务器转发更新
const online = ref(true)
const pending: (() => void)[] = []

function send(apply: () => void) {
  if (online.value) apply()
  else pending.push(apply)
}

function setOnline(value: boolean) {
  online.value = value
  if (value) for (const apply of pending.splice(0)) apply()
}

function createClient(id: string, name: string) {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  return { id, name, doc, awareness }
}

// Yjs 的 Awareness 会启动定时器，所以只在浏览器里创建
function createDemo() {
  const clients = [createClient('dai', '戴兜'), createClient('qing', '阿青')]
  const [first, second] = clients as [
    ReturnType<typeof createClient>,
    ReturnType<typeof createClient>,
  ]

  // 文档第一次创建时写入初始内容，通常在服务器上完成
  fillMap(first.doc.getMap('document'), [
    { type: 'heading', props: { level: 2 }, content: '上海周末出行计划' },
    {
      type: 'paragraph',
      content: '两个人一起改，各自的光标会显示在对方的编辑器里。选中文字可以发起评论。',
    },
    { type: 'checkItem', content: '订好周五晚上的车票' },
    { type: 'checkItem', content: '提前预约博物馆' },
    { type: 'checkItem', content: '带上充电宝和雨伞' },
    {
      type: 'table',
      rows: [
        { cells: ['时间', '安排', '负责'] },
        { cells: ['周六上午', '博物馆', '戴兜'] },
        { cells: ['周六下午', '外滩散步', '阿青'] },
      ],
    },
  ])
  Y.applyUpdate(second.doc, Y.encodeStateAsUpdate(first.doc))

  for (const from of clients) {
    for (const to of clients) {
      if (from === to) continue
      from.doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'remote') send(() => Y.applyUpdate(to.doc, update, 'remote'))
      })
      from.awareness.on(
        'update',
        ({ added, updated, removed }: Record<string, number[]>, origin: unknown) => {
          if (origin === 'remote') return
          const changed = [...added!, ...updated!, ...removed!]
          const update = encodeAwarenessUpdate(from.awareness, changed)
          send(() => applyAwarenessUpdate(to.awareness, update, 'remote'))
        },
      )
    }
  }

  const editors = clients.map((client) => ({
    name: client.name,
    author: { id: client.id, name: client.name },
    threads: ref<CommentThread[]>([]),
    extensions: [
      editorKit(),
      collaboration({
        map: client.doc.getMap('document'),
        awareness: client.awareness,
        user: { name: client.name },
        comments: client.doc.getMap('comments'),
      }),
    ],
  }))
  return { clients, editors }
}

const demo = shallowRef<ReturnType<typeof createDemo> | null>(null)

onMounted(() => (demo.value = createDemo()))

onBeforeUnmount(() => {
  for (const client of demo.value?.clients ?? []) {
    client.awareness.destroy()
    client.doc.destroy()
  }
})
</script>

<template>
  <div class="collab-demo">
    <div class="collab-demo__switch">
      <label class="collab-demo__toggle">
        <DouSwitch :model-value="online" @update:model-value="setOnline" />
        连接
      </label>
      <span class="collab-demo__status" aria-live="polite">
        {{ online ? '修改实时同步' : '已断开，修改会在重新连接后合并' }}
      </span>
    </div>
    <div class="collab-demo__editors">
      <section v-for="editor in demo?.editors" :key="editor.name" class="collab-demo__pane">
        <div class="collab-demo__name">{{ editor.name }}</div>
        <DouEditor
          v-model:comments="editor.threads.value"
          :extensions="editor.extensions"
          :author="editor.author"
          :aria-label="`${editor.name}的编辑器`"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.collab-demo {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.collab-demo__switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.collab-demo__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
}

.collab-demo__status {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.collab-demo__editors {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  /* the editors are created after mounting */
  min-height: 280px;
  gap: 16px;
}

.collab-demo__pane {
  min-width: 0;
  padding: 12px 12px 12px 0;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}

.collab-demo__name {
  margin: 0 0 8px 16px;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
