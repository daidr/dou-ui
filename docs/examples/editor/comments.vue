<script setup lang="ts">
import { DouEditor, type EditorDocument, type PartialBlock } from '@dou-ui/editor'
import type { CommentThread } from 'dou-ui'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'

const me = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const minutes = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString()

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '上海门店开业方案' },
    {
      content: [
        { type: 'text', text: '新店计划在' },
        { type: 'text', text: '十二月第一个周末', comments: ['date'] },
        { type: 'text', text: '开业，开业当天' },
        { type: 'text', text: '全场八折', comments: ['price'] },
        { type: 'text', text: '，前一百位顾客赠送帆布袋。' },
      ],
    },
    { type: 'checkItem', content: '确认装修验收时间' },
    { type: 'checkItem', content: '招募四名店员' },
  ],
})

const threads = ref<CommentThread[]>([
  {
    id: 'date',
    comments: [
      {
        id: 'd1',
        author: qing,
        body: '那周商场也有活动，人流会不会太大？',
        createdAt: minutes(90),
      },
      { id: 'd2', author: me, body: '人多正好，提前和物业打好招呼。', createdAt: minutes(30) },
    ],
  },
  {
    id: 'price',
    comments: [{ id: 'p1', author: qing, body: '八折和会员价能叠加吗？', createdAt: minutes(12) }],
  },
])
const active = ref<string | null>(null)
const editor = useTemplateRef<InstanceType<typeof DouEditor>>('editor')

// 被评论的文字，文档或评论变化时重新读取
const quotes = ref<Record<string, string>>({})
function readQuotes() {
  const anchors = editor.value?.getCommentAnchors() ?? {}
  quotes.value = Object.fromEntries(
    Object.entries(anchors).map(([id, anchor]) => [id, anchor?.text ?? '（原文已删除）']),
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
      aria-label="开业方案"
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
      <p v-if="!open.length" class="comments-demo__empty">选中一段文字，点击工具栏上的评论按钮。</p>
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
