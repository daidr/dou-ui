<script setup lang="ts">
import { DouEditor, editorKit, type EditorDocument, type PartialBlock } from '@dou-ui/editor'
import { whiteboardBlock, type BoardCommentTarget } from '@dou-ui/editor/flow'
import type { CommentThread } from 'dou-ui'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'

const extensions = [editorKit(), whiteboardBlock()]
const me = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const minutes = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString()

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '上海门店开业当天' },
    { type: 'paragraph', content: '当天的流程画在下面，对哪一步有意见就评论在那一步上。' },
    {
      type: 'whiteboard',
      props: {
        height: 260,
        board: {
          version: 1,
          nodes: [
            {
              id: 'open',
              type: 'shape',
              x: 0,
              y: 40,
              width: 150,
              height: 72,
              data: { text: '9:30 开门' },
            },
            {
              id: 'gift',
              type: 'shape',
              x: 220,
              y: 40,
              width: 150,
              height: 72,
              data: { text: '送帆布袋' },
              comments: ['t-gift'],
            },
            {
              id: 'close',
              type: 'shape',
              x: 440,
              y: 40,
              width: 150,
              height: 72,
              data: { text: '21:00 盘点' },
            },
          ],
          edges: [
            { id: 'e1', source: { node: 'open' }, target: { node: 'gift' } },
            { id: 'e2', source: { node: 'gift' }, target: { node: 'close' } },
          ],
        },
      },
    },
  ],
})

const threads = ref<CommentThread[]>([
  {
    id: 't-gift',
    comments: [
      { id: 'g1', author: qing, body: '一百个够吗？去年排了两百多人。', createdAt: minutes(20) },
    ],
  },
])
const active = ref<string | null>(null)
const editor = useTemplateRef<InstanceType<typeof DouEditor>>('editor')

// 讨论在哪：文字上的是被评论的文字，白板上的是图形或连线上的文字
const where = (text: string, target: BoardCommentTarget) =>
  `白板：${text || ('edge' in target ? '连线' : '图形')}`
const quotes = ref<Record<string, string>>({})
function readQuotes() {
  const anchors = editor.value?.getCommentAnchors() ?? {}
  quotes.value = Object.fromEntries(
    Object.entries(anchors).map(([id, anchor]) => [
      id,
      !anchor
        ? '（评论的内容已删除）'
        : anchor.type
          ? where(anchor.text, anchor.target as BoardCommentTarget)
          : anchor.text,
    ]),
  )
}
onMounted(readQuotes)
watch(threads, readQuotes, { flush: 'post' })

const open = computed(() => threads.value.filter((thread) => !thread.resolved))
</script>

<template>
  <div class="comments-demo">
    <DouEditor
      ref="editor"
      v-model="doc"
      v-model:comments="threads"
      v-model:active-comment="active"
      :author="me"
      aria-label="开业当天"
      :extensions="extensions"
      class="comments-demo__editor"
      @change="readQuotes"
    />
    <aside class="comments-demo__side" aria-label="评论">
      <div class="comments-demo__title">评论 {{ open.length }}</div>
      <button
        v-for="thread in open"
        :key="thread.id"
        type="button"
        class="comments-demo__item"
        :class="{ 'is-active': thread.id === active }"
        @click="active = thread.id"
      >
        <span class="comments-demo__quote">{{ quotes[thread.id] }}</span>
        <span class="comments-demo__text">
          {{ thread.comments[0]?.author.name }}：{{ thread.comments[0]?.body }}
        </span>
        <span v-if="thread.comments.length > 1" class="comments-demo__count">
          {{ thread.comments.length - 1 }} 条回复
        </span>
      </button>
      <p v-if="!open.length" class="comments-demo__empty">打开白板，右键图形发起评论。</p>
    </aside>
  </div>
</template>

<style scoped>
.comments-demo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 24px;
}

@media (max-width: 720px) {
  .comments-demo {
    grid-template-columns: minmax(0, 1fr);
  }
}

.comments-demo__side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.comments-demo__title {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-medium);
}

.comments-demo__item {
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
    background-color: var(
      --dou-color-fill-hover,
      color-mix(in oklab, currentColor 4%, transparent)
    );
  }

  &.is-active {
    border-color: var(--dou-color-warning);
  }
}

.comments-demo__quote {
  padding-inline-start: 8px;
  border-inline-start: 2px solid var(--dou-color-warning);
  color: var(--dou-color-text-secondary);
}

.comments-demo__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comments-demo__count,
.comments-demo__empty {
  margin: 0;
  color: var(--dou-color-text-tertiary);
  font-size: 12px;
}
</style>
