<script setup lang="ts">
import { type CodeExtension, DouCodeEditor, json } from '@dou-ui/code'
import { collaboration } from '@dou-ui/code/collaboration'
import { DouSwitch } from 'dou-ui'
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue'
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

interface Client {
  name: string
  doc: Y.Doc
  awareness: Awareness
  code: Ref<string>
  extensions: CodeExtension[]
}

function createClient(name: string): Client {
  const doc = new Y.Doc()
  return {
    name,
    doc,
    awareness: new Awareness(doc),
    // 协同时文本从共享文档读取，这里的初始值不会用到
    code: ref(''),
    extensions: [],
  }
}

// Yjs 的 Awareness 会启动定时器，所以只在浏览器里创建
function createDemo() {
  const clients = [createClient('戴兜'), createClient('阿青')]
  const [first, second] = clients as [Client, Client]

  // 共享文档第一次创建时写入初始文本，通常在服务器上完成
  first.doc.getText('code').insert(
    0,
    `{
  "name": "周末读书会",
  "city": "上海",
  "date": "2026-11-08",
  "seats": 24,
  "hosts": ["戴兜", "阿青"],
  "agenda": [
    { "time": "14:00", "topic": "签到" },
    { "time": "14:30", "topic": "分享" }
  ]
}
`,
  )
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

  for (const client of clients)
    client.extensions = [
      collaboration({
        text: client.doc.getText('code'),
        awareness: client.awareness,
        user: { name: client.name },
      }),
    ]
  return clients
}

const clients = shallowRef<Client[]>([])

onMounted(() => (clients.value = createDemo()))

onBeforeUnmount(() => {
  for (const client of clients.value) {
    client.awareness.destroy()
    client.doc.destroy()
  }
})
</script>

<template>
  <div class="code-collab">
    <label class="code-collab__switch">
      <DouSwitch :model-value="online" @update:model-value="setOnline" />
      {{ online ? '已连接' : '已断开，修改会在重新连接后合并' }}
    </label>
    <div class="code-collab__panes">
      <section v-for="client in clients" :key="client.name" class="code-collab__pane">
        <div class="code-collab__name">{{ client.name }}</div>
        <DouCodeEditor
          v-model="client.code.value"
          :language="json"
          :extensions="client.extensions"
          :aria-label="`${client.name}的活动配置`"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.code-collab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.code-collab__switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
}

.code-collab__panes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  /* the editors are created after mounting */
  min-height: 300px;
  gap: 16px;
}

.code-collab__pane {
  min-width: 0;
}

.code-collab__name {
  margin: 0 0 8px;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
