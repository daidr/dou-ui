<script setup lang="ts">
import { DouFlowEditor, flowKit, type FlowDocument, type FlowExtension } from '@dou-ui/flow'
import { collaboration, fillMaps } from '@dou-ui/flow/collaboration'
import { whiteboardKit } from '@dou-ui/flow/whiteboard'
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
  flow: Ref<FlowDocument>
  extensions: (FlowExtension | FlowExtension[])[]
}

function createClient(name: string): Client {
  const doc = new Y.Doc()
  return {
    name,
    doc,
    awareness: new Awareness(doc),
    // 协同时节点从共享文档读取，这里的初始值不会用到
    flow: ref<FlowDocument>({ version: 1, nodes: [], edges: [] }),
    extensions: [],
  }
}

// Yjs 的 Awareness 会启动定时器，所以只在浏览器里创建
function createDemo() {
  const clients = [createClient('戴兜'), createClient('阿青')]
  const [first, second] = clients as [Client, Client]

  // 共享文档第一次创建时写入初始节点，通常在服务器上完成
  fillMaps(
    { nodes: first.doc.getMap('nodes'), edges: first.doc.getMap('edges') },
    {
      version: 1,
      nodes: [
        {
          id: 'goal',
          type: 'shape',
          x: 0,
          y: 0,
          width: 160,
          height: 80,
          data: { shape: 'rect', text: '周末团建去哪' },
        },
        {
          id: 'a',
          type: 'sticky',
          x: 240,
          y: -40,
          width: 120,
          height: 120,
          data: { text: '崇明骑车' },
        },
        {
          id: 'b',
          type: 'sticky',
          x: 400,
          y: -40,
          width: 120,
          height: 120,
          data: { text: '西岸看展', tone: 'success' },
        },
      ],
      edges: [
        {
          id: 'e1',
          type: 'connector',
          source: { node: 'goal', port: 'right' },
          target: { node: 'a', port: 'left-in' },
        },
      ],
    },
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
      flowKit(),
      // 每个人有自己的工具和工具栏
      whiteboardKit(),
      collaboration({
        nodes: client.doc.getMap('nodes'),
        edges: client.doc.getMap('edges'),
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
  <div class="board-collab">
    <div class="board-collab__switch">
      <label class="board-collab__toggle">
        <DouSwitch :model-value="online" @update:model-value="setOnline" />
        连接
      </label>
      <span class="board-collab__status" aria-live="polite">
        {{ online ? '修改实时同步' : '已断开，修改会在重新连接后合并' }}
      </span>
    </div>
    <section v-for="client in clients" :key="client.name" class="board-collab__pane">
      <div class="board-collab__name">{{ client.name }}</div>
      <DouFlowEditor
        v-model="client.flow.value"
        :extensions="client.extensions"
        fit-view
        :aria-label="`${client.name}的白板`"
        style="height: 280px"
      />
    </section>
  </div>
</template>

<style scoped>
.board-collab {
  display: flex;
  flex-direction: column;
  /* the editors are created after mounting */
  min-height: 680px;
  gap: 16px;
}

.board-collab__switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.board-collab__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
}

.board-collab__status {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.board-collab__pane {
  min-width: 0;
}

.board-collab__name {
  margin: 0 0 8px;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
