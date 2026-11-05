<script setup lang="ts">
import { DouFlowEditor, type FlowDocument } from '@dou-ui/flow'
import { DouCheckbox, type CommentThread } from 'dou-ui'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'

const me = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const minutes = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString()

const doc = ref<FlowDocument>({
  version: 1,
  nodes: [
    { id: 'lead', x: 0, y: 0, data: { label: '主管审批', outputs: [{ id: 'out' }] } },
    {
      id: 'finance',
      x: 320,
      y: 0,
      data: { label: '财务复核', inputs: [{ id: 'in' }], outputs: [{ id: 'out' }] },
      comments: ['limit'],
    },
    { id: 'pay', x: 640, y: 0, data: { label: '打款', inputs: [{ id: 'in' }] } },
  ],
  edges: [
    {
      id: 'e1',
      source: { node: 'lead', port: 'out' },
      target: { node: 'finance', port: 'in' },
      label: '超过 5000 元',
      comments: ['skip'],
    },
    { id: 'e2', source: { node: 'finance', port: 'out' }, target: { node: 'pay', port: 'in' } },
  ],
})

const threads = ref<CommentThread[]>([
  {
    id: 'limit',
    comments: [
      { id: 'l1', author: qing, body: '复核要不要限定两个工作日内完成？', createdAt: minutes(90) },
      { id: 'l2', author: me, body: '可以，超时提醒财务主管。', createdAt: minutes(40) },
    ],
  },
  {
    id: 'skip',
    comments: [
      { id: 's1', author: qing, body: '5000 元以下是不是直接打款？', createdAt: minutes(12) },
    ],
  },
])
const active = ref<string | null>(null)
const open = computed(() => threads.value.filter((thread) => !thread.resolved))
// 已解决的讨论也列出来，点开后可以在卡片上重新打开
const showResolved = ref(false)
const listed = computed(() => (showResolved.value ? threads.value : open.value))
const editor = useTemplateRef<InstanceType<typeof DouFlowEditor>>('editor')

// 每条讨论在哪个节点或连线上，文档或评论变化时重新读取
const places = ref<Record<string, string>>({})
const name = (id: string) => doc.value.nodes.find((node) => node.id === id)?.data?.label
function readPlaces() {
  const anchors = editor.value?.getCommentAnchors() ?? {}
  places.value = Object.fromEntries(
    Object.entries(anchors).map(([id, on]) => {
      if (!on) return [id, '（已删除）']
      if ('node' in on) return [id, String(name(on.node) ?? '节点')]
      const edge = doc.value.edges.find((item) => item.id === on.edge)
      return [id, `${name(edge?.source.node ?? '')} → ${name(edge?.target.node ?? '')}`]
    }),
  )
}
onMounted(readPlaces)
watch([threads, doc], readPlaces, { flush: 'post' })
</script>

<template>
  <div class="flow-comments-demo">
    <DouFlowEditor
      ref="editor"
      v-model="doc"
      v-model:comments="threads"
      v-model:active-comment="active"
      :author="me"
      fit-view
      aria-label="报销流程"
      style="height: 240px"
    />
    <aside class="flow-comments-demo__side" aria-label="评论">
      <div class="flow-comments-demo__head">
        <span class="flow-comments-demo__title">评论 {{ open.length }}</span>
        <DouCheckbox v-model="showResolved" size="sm">显示已解决</DouCheckbox>
      </div>
      <button
        v-for="thread in listed"
        :key="thread.id"
        type="button"
        class="flow-comments-demo__item"
        :class="{ 'is-active': thread.id === active }"
        @click="active = thread.id"
      >
        <span class="flow-comments-demo__place">
          {{ places[thread.id] }}<template v-if="thread.resolved"> · 已解决</template>
        </span>
        <span class="flow-comments-demo__text">
          {{ thread.comments[0]?.author.name }}：{{ thread.comments[0]?.body }}
        </span>
        <span v-if="thread.comments.length > 1" class="flow-comments-demo__count">
          {{ thread.comments.length - 1 }} 条回复
        </span>
      </button>
      <p v-if="!listed.length" class="flow-comments-demo__empty">右键节点或连线，选择“评论”。</p>
    </aside>
  </div>
</template>

<style scoped>
.flow-comments-demo {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 评论列表在编辑器下方，一行放几张 */
.flow-comments-demo__side {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
  min-width: 0;
}

.flow-comments-demo__head {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.flow-comments-demo__title {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-medium);
}
.flow-comments-demo__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: none;
  color: var(--dou-color-text);
  font: inherit;
  font-size: var(--dou-font-size-sm);
  text-align: start;
  cursor: pointer;

  &:hover {
    background-color: color-mix(in oklab, currentColor 4%, transparent);
  }

  &.is-active {
    border-color: var(--dou-color-focus);
  }
}

.flow-comments-demo__place {
  padding-inline-start: 8px;
  border-inline-start: 2px solid var(--dou-color-focus);
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.flow-comments-demo__text {
  overflow-x: clip;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-comments-demo__count,
.flow-comments-demo__empty {
  margin: 0;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
