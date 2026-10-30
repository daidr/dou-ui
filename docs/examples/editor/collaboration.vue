<script setup lang="ts">
import { DouEditor, starterKit } from '@dou-ui/editor'
import { collaboration, fillFragment } from '@dou-ui/editor/collaboration'
import { DouSwitch } from 'dou-ui'
import { onBeforeUnmount, ref } from 'vue'
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

function createClient(name: string) {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  return { name, doc, awareness }
}

const clients = [createClient('戴兜'), createClient('阿青')]
const [first, second] = clients as [
  ReturnType<typeof createClient>,
  ReturnType<typeof createClient>,
]

// 文档第一次创建时写入初始内容，通常在服务器上完成
fillFragment(first.doc.getXmlFragment('document'), [
  { type: 'heading', props: { level: 2 }, content: '上海周末出行计划' },
  { type: 'paragraph', content: '两个人一起改，各自的光标会显示在对方的编辑器里。' },
  { type: 'checkItem', content: '订好周五晚上的车票' },
  { type: 'checkItem', content: '提前预约博物馆' },
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
  extensions: [
    starterKit(),
    collaboration({
      fragment: client.doc.getXmlFragment('document'),
      awareness: client.awareness,
      user: { name: client.name },
    }),
  ],
}))

onBeforeUnmount(() => {
  for (const client of clients) {
    client.awareness.destroy()
    client.doc.destroy()
  }
})
</script>

<template>
  <div class="collab-demo">
    <label class="collab-demo__switch">
      <DouSwitch :model-value="online" @update:model-value="setOnline" />
      {{ online ? '已连接' : '已断开，修改会在重新连接后合并' }}
    </label>
    <div class="collab-demo__editors">
      <section v-for="editor in editors" :key="editor.name" class="collab-demo__pane">
        <div class="collab-demo__name">{{ editor.name }}</div>
        <DouEditor :extensions="editor.extensions" :label="`${editor.name}的编辑器`" />
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
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
}

.collab-demo__editors {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
