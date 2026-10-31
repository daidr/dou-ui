<script setup lang="ts">
import { DouFormBuilder, type FormBuilderExtension, type FormDocument } from '@dou-ui/form-builder'
import { collaboration, collaborationColors, fillMaps } from '@dou-ui/form-builder/collaboration'
import { DouSwitch } from 'dou-ui'
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue'
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'

// 示例里两个设计器在同一个页面，用函数代替服务器转发更新
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
  color: string
  doc: Y.Doc
  awareness: Awareness
  form: Ref<FormDocument>
  selection: Ref<string[]>
  extensions: FormBuilderExtension[]
}

function createClient(name: string, color: string, selection: string[]): Client {
  const doc = new Y.Doc()
  return {
    name,
    color,
    doc,
    awareness: new Awareness(doc),
    // 协同时表单从共享文档读取，这里的初始值不会用到
    form: ref<FormDocument>({ version: 1, nodes: [] }),
    selection: ref(selection),
    extensions: [],
  }
}

// Yjs 的 Awareness 会启动定时器，所以只在浏览器里创建
function createDemo() {
  const clients = [
    createClient('戴兜', collaborationColors[1]!, ['name']),
    createClient('阿青', collaborationColors[2]!, ['city']),
  ]
  const [first, second] = clients as [Client, Client]

  // 共享文档第一次创建时写入表单，通常在服务器上完成
  fillMaps(
    { nodes: first.doc.getMap('nodes'), settings: first.doc.getMap('settings') },
    {
      version: 1,
      nodes: [
        { id: 'name', type: 'input', name: 'name', label: '姓名', required: true, span: 6 },
        { id: 'phone', type: 'input', name: 'phone', label: '手机号', span: 6 },
        {
          id: 'city',
          type: 'select',
          name: 'city',
          label: '参加的场次',
          default: 'sh',
          props: {
            options: [
              { label: '上海', value: 'sh' },
              { label: '杭州', value: 'hz' },
            ],
          },
        },
        { id: 'note', type: 'textarea', name: 'note', label: '想听的话题' },
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
        nodes: client.doc.getMap('nodes'),
        settings: client.doc.getMap('settings'),
        awareness: client.awareness,
        user: { name: client.name, color: client.color },
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
  <div class="form-collab">
    <div class="form-collab__switch">
      <label class="form-collab__toggle">
        <DouSwitch :model-value="online" @update:model-value="setOnline" />
        连接
      </label>
      <span class="form-collab__status" aria-live="polite">
        {{ online ? '修改实时同步' : '已断开，修改会在重新连接后合并' }}
      </span>
    </div>
    <section v-for="client in clients" :key="client.name" class="form-collab__pane">
      <div class="form-collab__name">{{ client.name }}</div>
      <DouFormBuilder
        v-model="client.form.value"
        v-model:selection="client.selection.value"
        :extensions="client.extensions"
        class="form-collab__builder"
      />
    </section>
  </div>
</template>

<style scoped>
.form-collab {
  display: flex;
  flex-direction: column;
  /* the builders are created after mounting */
  min-height: 1040px;
  gap: 16px;
}

.form-collab__switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.form-collab__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
}

.form-collab__status {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.form-collab__pane {
  min-width: 0;
}

.form-collab__name {
  margin: 0 0 8px;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.form-collab__builder {
  --dou-form-builder-height: 480px;
}

/* a phone shows the canvas alone: no room to fill below the form */
@media (max-width: 640px) {
  .form-collab {
    min-height: 840px;
  }

  .form-collab__builder {
    --dou-form-builder-height: 380px;
  }
}
</style>
