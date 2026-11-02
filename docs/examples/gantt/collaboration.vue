<script setup lang="ts">
import { DouGantt, type GanttDocument, type GanttExtension } from '@dou-ui/gantt'
import { collaboration, fillMaps } from '@dou-ui/gantt/collaboration'
import { DouSwitch } from 'dou-ui'
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue'
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { day } from './dates'

// 示例里两个甘特图在同一个页面，用函数代替服务器转发更新
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
  plan: Ref<GanttDocument>
  extensions: GanttExtension[]
}

function createClient(name: string): Client {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  return {
    name,
    doc,
    awareness,
    // 协同时任务从共享文档读取，这里的初始值不会用到
    plan: ref<GanttDocument>({ version: 1, tasks: [], links: [] }),
    extensions: [],
  }
}

// Yjs 的 Awareness 会启动定时器，所以只在浏览器里创建
function createDemo() {
  const clients = [createClient('戴兜'), createClient('阿青')]
  const [first, second] = clients as [Client, Client]

  // 共享文档第一次创建时写入初始任务，通常在服务器上完成
  fillMaps(
    { tasks: first.doc.getMap('tasks'), links: first.doc.getMap('links') },
    {
      version: 1,
      tasks: [
        { id: 'shop', title: '上海门店开业' },
        {
          id: 'site',
          parent: 'shop',
          title: '确认场地',
          start: day(-3),
          end: day(-1),
          progress: 1,
        },
        { id: 'fit', parent: 'shop', title: '装修', start: day(0), end: day(9), progress: 0.3 },
        { id: 'hire', parent: 'shop', title: '招聘店员', start: day(2), end: day(8) },
        { id: 'train', parent: 'shop', title: '培训', start: day(10), end: day(12) },
        { id: 'open', parent: 'shop', title: '开业', type: 'milestone', start: day(13) },
      ],
      links: [
        { id: 'l1', from: 'site', to: 'fit' },
        { id: 'l2', from: 'fit', to: 'train' },
        { id: 'l3', from: 'hire', to: 'train' },
        { id: 'l4', from: 'train', to: 'open' },
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
      collaboration({
        tasks: client.doc.getMap('tasks'),
        links: client.doc.getMap('links'),
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
  <div class="gantt-collab">
    <div class="gantt-collab__switch">
      <label class="gantt-collab__toggle">
        <DouSwitch :model-value="online" @update:model-value="setOnline" />
        连接
      </label>
      <span class="gantt-collab__status" aria-live="polite">
        {{ online ? '修改实时同步' : '已断开，修改会在重新连接后合并' }}
      </span>
    </div>
    <section v-for="client in clients" :key="client.name" class="gantt-collab__pane">
      <div class="gantt-collab__name">{{ client.name }}</div>
      <DouGantt
        v-model="client.plan.value"
        :extensions="client.extensions"
        scheduling="auto"
        :table-width="200"
        :columns="[{ key: 'title' }]"
        :aria-label="`${client.name}的甘特图`"
        style="height: 320px"
      />
    </section>
  </div>
</template>

<style scoped>
.gantt-collab {
  display: flex;
  flex-direction: column;
  /* the charts are created after mounting */
  min-height: 760px;
  gap: 16px;
}

.gantt-collab__switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.gantt-collab__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
}

.gantt-collab__status {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.gantt-collab__pane {
  min-width: 0;
}

.gantt-collab__name {
  margin: 0 0 8px;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
