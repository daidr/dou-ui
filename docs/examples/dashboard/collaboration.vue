<script setup lang="ts">
import {
  DouDashboard,
  type DashboardCollaboration,
  type DashboardDocument,
} from '@dou-ui/dashboard'
import { chartWidget } from '@dou-ui/dashboard/chart'
import { collaboration, collaborationColors, fillMap } from '@dou-ui/dashboard/collaboration'
import { statWidget, textWidget } from '@dou-ui/dashboard/widgets'
import { DouSwitch } from 'dou-ui'
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue'
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { sources } from './sales-data'

const widgets = [statWidget(), textWidget(), chartWidget()]

// 示例里两个仪表盘在同一个页面，用函数代替服务器转发更新
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
  dashboard: Ref<DashboardDocument>
  collaboration: DashboardCollaboration
}

const initial: DashboardDocument = {
  version: 1,
  widgets: [
    {
      id: 'amount',
      type: 'stat',
      title: '销售额',
      props: { source: 'overview', field: 'amount', prefix: '¥', trend: 'trend', delta: 'delta' },
      place: { lg: { x: 0, y: 0, w: 3, h: 3 } },
    },
    {
      id: 'orders',
      type: 'stat',
      title: '订单数',
      props: { source: 'overview', field: 'orders', suffix: '单' },
      place: { lg: { x: 3, y: 0, w: 3, h: 3 } },
    },
    {
      id: 'regions',
      type: 'chart',
      title: '各地区销售额',
      props: {
        source: 'region',
        kind: 'bar',
        x: 'name',
        y: ['value'],
        labels: { value: '销售额' },
      },
      place: { lg: { x: 0, y: 3, w: 4, h: 4 } },
    },
    {
      id: 'note',
      type: 'text',
      title: '说明',
      props: { text: '戴兜和阿青一起整理 10 月的看板。', size: 'sm' },
      place: { lg: { x: 4, y: 3, w: 2, h: 4 } },
    },
  ],
}

// Yjs 的 Awareness 会启动定时器，所以只在浏览器里创建
function createDemo() {
  const people = [
    { name: '戴兜', color: collaborationColors[1]! },
    { name: '阿青', color: collaborationColors[2]! },
  ]
  const docs = people.map(() => new Y.Doc())
  const awareness = docs.map((doc) => new Awareness(doc))

  // 共享文档第一次创建时写入仪表盘，通常在服务器上完成
  fillMap(docs[0]!.getMap('widgets'), initial)
  Y.applyUpdate(docs[1]!, Y.encodeStateAsUpdate(docs[0]!))

  docs.forEach((from, i) => {
    docs.forEach((to, j) => {
      if (i === j) return
      from.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'remote') send(() => Y.applyUpdate(to, update, 'remote'))
      })
      awareness[i]!.on(
        'update',
        ({ added, updated, removed }: Record<string, number[]>, origin: unknown) => {
          if (origin === 'remote') return
          const update = encodeAwarenessUpdate(awareness[i]!, [...added!, ...updated!, ...removed!])
          send(() => applyAwarenessUpdate(awareness[j]!, update, 'remote'))
        },
      )
    })
  })

  return people.map((person, i): Client => ({
    name: person.name,
    doc: docs[i]!,
    awareness: awareness[i]!,
    // 协同时仪表盘从共享文档读取，这里的初始值不会用到
    dashboard: ref<DashboardDocument>({ version: 1, widgets: [] }),
    collaboration: collaboration({
      widgets: docs[i]!.getMap('widgets'),
      awareness: awareness[i]!,
      user: person,
    }),
  }))
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
  <div class="dashboard-collab">
    <div class="dashboard-collab__switch">
      <label class="dashboard-collab__toggle">
        <DouSwitch :model-value="online" @update:model-value="setOnline" />
        连接
      </label>
      <span class="dashboard-collab__status" aria-live="polite">
        {{ online ? '修改实时同步' : '已断开，修改会在重新连接后合并' }}
      </span>
    </div>
    <section v-for="client in clients" :key="client.name" class="dashboard-collab__pane">
      <div class="dashboard-collab__name">{{ client.name }}</div>
      <DouDashboard
        v-model="client.dashboard.value"
        :widgets="widgets"
        :sources="sources"
        :collaboration="client.collaboration"
        :columns="{ lg: 6, sm: 1 }"
        :breakpoints="{ lg: 480, sm: 0 }"
        :row-height="48"
        :gap="12"
        editable
      />
    </section>
  </div>
</template>

<style scoped>
.dashboard-collab {
  display: flex;
  flex-direction: column;
  /* the dashboards are created after mounting */
  min-height: 900px;
  gap: 16px;
}

.dashboard-collab__switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.dashboard-collab__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
}

.dashboard-collab__status {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.dashboard-collab__pane {
  min-width: 0;
}

.dashboard-collab__name {
  margin: 0 0 8px;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
