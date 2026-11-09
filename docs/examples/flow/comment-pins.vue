<script setup lang="ts">
import { DouFlowEditor, flowKit, type FlowDocument } from '@dou-ui/flow'
import { whiteboardKit, type WhiteboardTool } from '@dou-ui/flow/whiteboard'
import type { CommentThread } from 'dou-ui'
import { onMounted, ref, useTemplateRef, watch } from 'vue'

const me = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const minutes = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString()

// 打开时就是评论工具：点在方案上，就在那一点发起讨论
const tool = ref<WhiteboardTool>('comment')
const extensions = [flowKit(), whiteboardKit({ tool })]

const doc = ref<FlowDocument>({
  version: 1,
  nodes: [
    {
      id: 'plan-a',
      type: 'shape',
      x: 0,
      y: 0,
      width: 280,
      height: 180,
      data: { shape: 'rect', text: '方案一：活动首页' },
      comments: ['button', 'banner'],
      commentPins: { button: { x: 0.78, y: 0.82 }, banner: { x: 0.2, y: 0.18 } },
    },
    {
      id: 'plan-b',
      type: 'shape',
      x: 0,
      y: 220,
      width: 280,
      height: 180,
      data: { shape: 'rect', text: '方案二：活动首页', tone: 'primary' },
      comments: ['empty'],
      commentPins: { empty: { x: 0.85, y: 0.15 } },
    },
  ],
  edges: [],
})

const threads = ref<CommentThread[]>([
  {
    id: 'button',
    comments: [
      { id: 'b1', author: qing, body: '报名按钮太小，手机上不好点。', createdAt: minutes(30) },
    ],
  },
  {
    id: 'banner',
    comments: [{ id: 'n1', author: me, body: '横幅换成上海展馆的照片？', createdAt: minutes(20) }],
  },
  {
    id: 'empty',
    comments: [{ id: 'e1', author: qing, body: '右上角空了一块。', createdAt: minutes(8) }],
  },
])
const active = ref<string | null>(null)
const editor = useTemplateRef<InstanceType<typeof DouFlowEditor>>('editor')

/** “右上”“中间”：钉子在节点里的大致位置，给人看，也可以交给 AI */
function where(at: { x: number; y: number }) {
  const row = at.y < 1 / 3 ? '上' : at.y > 2 / 3 ? '下' : ''
  const column = at.x < 1 / 3 ? '左' : at.x > 2 / 3 ? '右' : ''
  return row || column ? `${column}${row}` : '中间'
}

const places = ref<{ id: string; text: string; place: string; number?: number }[]>([])
function read() {
  const anchors = editor.value?.getCommentAnchors() ?? {}
  places.value = threads.value.flatMap((thread) => {
    const on = anchors[thread.id]
    if (thread.resolved || !on || !('node' in on)) return []
    const node = doc.value.nodes.find((n) => n.id === on.node)
    const [name = '节点'] = String(node?.data?.text ?? '').split('：')
    return [
      {
        id: thread.id,
        text: thread.comments[0]?.body ?? '',
        place: on.at ? `${name} · ${where(on.at)}` : name,
        number: on.at ? on.number : undefined,
      },
    ]
  })
}
onMounted(read)
watch([doc, threads], read, { deep: true, flush: 'post' })
</script>

<template>
  <div class="comment-pins">
    <DouFlowEditor
      ref="editor"
      v-model="doc"
      v-model:comments="threads"
      v-model:active-comment="active"
      :extensions="extensions"
      :author="me"
      fit-view
      aria-label="活动首页方案评审"
      style="height: 440px"
    />
    <ul class="comment-pins__list">
      <li v-for="item in places" :key="item.id">
        <button type="button" :aria-pressed="active === item.id" @click="active = item.id">
          <span v-if="item.number" class="comment-pins__number">{{ item.number }}</span>
          <span class="comment-pins__place">{{ item.place }}</span>
          {{ item.text }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.comment-pins {
  display: grid;
  gap: 12px;
}
.comment-pins__list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.comment-pins__list button {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--dou-radius-control);
  background: none;
  color: var(--dou-color-text);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.comment-pins__list button:hover,
.comment-pins__list button[aria-pressed='true'] {
  background-color: var(--dou-color-bg-muted);
}
.comment-pins__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  margin-inline-end: 8px;
  border: 1px solid var(--dou-color-border);
  border-radius: 10px 10px 10px 2px;
  font-size: var(--dou-font-size-sm);
  font-variant-numeric: tabular-nums;
}
.comment-pins__place {
  margin-inline-end: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
