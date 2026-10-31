<script setup lang="ts">
import {
  DouSheet,
  DouSheetTabs,
  DouSheetToolbar,
  type SheetExtension,
  type SheetSelection,
  type SheetWorkbook,
} from '@dou-ui/sheet'
import { collaboration, collaborationColors, fillBook } from '@dou-ui/sheet/collaboration'
import { DouSwitch } from 'dou-ui'
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue'
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'

// 示例里两个表格在同一个页面，用函数代替服务器转发更新
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
  book: Ref<SheetWorkbook>
  selection: Ref<SheetSelection>
  extensions: SheetExtension[]
}

const head = (value: string) => ({ value, style: 'head' })
const money = (value: number) => ({ value, format: '¥#,##0' })

const start: SheetWorkbook = {
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      id: 'sales',
      name: '十月',
      freeze: { rows: 1 },
      rowCount: 30,
      colCount: 8,
      colSizes: { 0: 112 },
      cells: [
        [head('门店'), head('销售额'), head('目标'), head('完成率')],
        ...[
          ['上海静安', 196800, 180000],
          ['上海徐汇', 162900, 170000],
          ['上海浦东', 148200, 150000],
        ].map(([store, sales, goal], i) => [
          store,
          money(sales as number),
          money(goal as number),
          { value: `=B${i + 2}/C${i + 2}`, format: '0.0%' },
        ]),
        [head('合计'), { value: '=SUM(B2:B4)', format: '¥#,##0' }],
      ],
      conditionalFormats: [{ range: 'D2:D4', when: { op: 'lt', value: 1 }, style: 'head' }],
    },
  ],
}

const pick = (row: number, col: number, toRow = row, toCol = col): SheetSelection => ({
  active: { row, col },
  ranges: [{ start: { row, col }, end: { row: toRow, col: toCol } }],
})

function createClient(name: string, selection: SheetSelection): Client {
  const doc = new Y.Doc()
  return {
    name,
    doc,
    awareness: new Awareness(doc),
    // 协同时工作簿从共享文档读取，这里的初始值不会用到
    book: ref<SheetWorkbook>({ sheets: [{ name: '十月', cells: [] }] }),
    selection: ref(selection),
    extensions: [],
  }
}

// Yjs 的 Awareness 会启动定时器，所以只在浏览器里创建
function createDemo() {
  const clients = [createClient('戴兜', pick(1, 1, 3, 1)), createClient('阿青', pick(2, 2))]
  const [first, second] = clients as [Client, Client]

  // 共享文档第一次创建时写入工作簿，通常在服务器上完成
  fillBook(first.doc.getMap('book'), start)
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

  clients.forEach((client, i) => {
    client.extensions = [
      collaboration({
        book: client.doc.getMap('book'),
        awareness: client.awareness,
        user: { name: client.name, color: collaborationColors[i + 1] },
      }),
    ]
  })
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
  <div class="sheet-collab">
    <div class="sheet-collab__switch">
      <label class="sheet-collab__toggle">
        <DouSwitch :model-value="online" @update:model-value="setOnline" />
        连接
      </label>
      <span class="sheet-collab__status" aria-live="polite">
        {{ online ? '修改实时同步' : '已断开，修改会在重新连接后合并' }}
      </span>
    </div>
    <section v-for="client in clients" :key="client.name" class="sheet-collab__pane">
      <div class="sheet-collab__name">{{ client.name }}</div>
      <DouSheet
        v-model="client.book.value"
        v-model:selection="client.selection.value"
        :extensions="client.extensions"
        :aria-label="`${client.name}的表格`"
        class="sheet-collab__sheet"
      >
        <template #header>
          <DouSheetToolbar :tools="['undo', 'redo', '|', 'bold', 'fill', '|', 'format']" />
        </template>
        <template #footer>
          <DouSheetTabs />
        </template>
      </DouSheet>
    </section>
  </div>
</template>

<style scoped>
.sheet-collab {
  display: flex;
  flex-direction: column;
  /* the sheets are created after mounting */
  min-height: 720px;
  gap: 16px;
}

.sheet-collab__switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.sheet-collab__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
}

.sheet-collab__status {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.sheet-collab__pane {
  min-width: 0;
}

.sheet-collab__name {
  margin: 0 0 8px;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.sheet-collab__sheet {
  height: 300px;
}
</style>
