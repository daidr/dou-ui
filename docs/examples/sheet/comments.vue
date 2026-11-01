<script setup lang="ts">
import { DouSheet, type SheetWorkbook } from '@dou-ui/sheet'
import type { CommentThread } from 'dou-ui'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'

const me = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const minutes = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString()
const head = (value: string) => ({ value, style: 'head' })
const money = (value: number) => ({ value, format: '¥#,##0' })

const book = ref<SheetWorkbook>({
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '活动预算',
      freeze: { rows: 1 },
      colSizes: { 0: 120, 3: 160 },
      rowCount: 12,
      colCount: 6,
      cells: [
        [head('项目'), head('预算'), head('负责人'), head('备注')],
        ['场地', { ...money(48000), comment: 'venue' }, '戴兜', '已签合同'],
        ['物料', money(12600), '阿青', ''],
        ['餐饮', { ...money(9800), comment: 'food' }, '阿青', '按 120 人计'],
        ['交通', money(3200), '戴兜', ''],
      ],
    },
  ],
})

const threads = ref<CommentThread[]>([
  {
    id: 'venue',
    comments: [
      { id: 'v1', author: qing, body: '场地费含税吗？', createdAt: minutes(80) },
      { id: 'v2', author: me, body: '含税，发票下周开。', createdAt: minutes(45) },
    ],
  },
  {
    id: 'food',
    comments: [
      { id: 'f1', author: qing, body: '人数可能到 150，要不要加预算？', createdAt: minutes(10) },
    ],
  },
])
const active = ref<string | null>(null)
const open = computed(() => threads.value.filter((thread) => !thread.resolved))
const sheet = useTemplateRef<InstanceType<typeof DouSheet>>('sheet')

// 每条讨论所在的单元格，表格或评论变化时重新读取
const cells = ref<Record<string, string>>({})
function readCells() {
  const anchors = sheet.value?.getCommentAnchors() ?? {}
  cells.value = Object.fromEntries(
    Object.entries(anchors).map(([id, anchor]) => [id, anchor?.address ?? '（单元格已删除）']),
  )
}
onMounted(readCells)
watch([threads, book], readCells, { flush: 'post' })
</script>

<template>
  <div class="sheet-comments-demo">
    <DouSheet
      ref="sheet"
      v-model="book"
      v-model:comments="threads"
      v-model:active-comment="active"
      :author="me"
      aria-label="活动预算"
      style="height: 300px"
    />
    <aside class="sheet-comments-demo__side" aria-label="评论">
      <div class="sheet-comments-demo__title">评论 {{ open.length }}</div>
      <button
        v-for="thread in open"
        :key="thread.id"
        type="button"
        class="sheet-comments-demo__item"
        :class="{ 'is-active': thread.id === active }"
        @click="active = thread.id"
      >
        <span class="sheet-comments-demo__cell">{{ cells[thread.id] }}</span>
        <span class="sheet-comments-demo__text">
          {{ thread.comments[0]?.author.name }}：{{ thread.comments[0]?.body }}
        </span>
        <span v-if="thread.comments.length > 1" class="sheet-comments-demo__count">
          {{ thread.comments.length - 1 }} 条回复
        </span>
      </button>
      <p v-if="!open.length" class="sheet-comments-demo__empty">右键单元格，选择“添加评论”。</p>
    </aside>
  </div>
</template>

<style scoped>
.sheet-comments-demo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 24px;
}

@media (max-width: 720px) {
  .sheet-comments-demo {
    grid-template-columns: minmax(0, 1fr);
  }
}

.sheet-comments-demo__side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.sheet-comments-demo__title {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-medium);
}

.sheet-comments-demo__item {
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
    border-color: var(--dou-color-focus);
  }
}

.sheet-comments-demo__cell {
  padding-inline-start: 8px;
  border-inline-start: 2px solid var(--dou-color-focus);
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.sheet-comments-demo__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-comments-demo__count,
.sheet-comments-demo__empty {
  margin: 0;
  color: var(--dou-color-text-tertiary);
  font-size: 12px;
}
</style>
