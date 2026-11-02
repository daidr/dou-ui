<script setup lang="ts">
import {
  DouSheet,
  DouSheetToolbar,
  defineSheetCellType,
  defineSheetExtension,
  useSheet,
  type SheetCellRenderProps,
  type SheetWorkbook,
} from '@dou-ui/sheet'
import { DouButton, DouTag } from 'dou-ui'
import { computed, defineComponent, h, ref } from 'vue'

/** 进度条：表格里是组件，导出图片和打印时用 draw 画成同样的样子。 */
const ProgressBar = defineComponent<SheetCellRenderProps>(
  (props) => () => {
    if (typeof props.value !== 'number') return h('span', { class: 'dou-sheet__text' }, props.text)
    return h('span', { class: 'progress-cell' }, [
      h('span', { class: 'progress-cell__track' }, [
        h('span', {
          class: 'progress-cell__bar',
          style: { width: `${Math.min(1, Math.max(0, props.value)) * 100}%` },
        }),
      ]),
      h('span', { class: 'progress-cell__text' }, props.text),
    ])
  },
  { props: ['value', 'text', 'setup', 'readonly'] },
)

const progress = defineSheetCellType({
  name: 'progress',
  parse: (text) => {
    const n = Number.parseFloat(text)
    return Number.isNaN(n) ? undefined : { value: Math.min(1, Math.max(0, n / 100)) }
  },
  format: (value) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : undefined),
  render: ProgressBar,
  // 坐标以单元格左上角为原点；文字交给 draw.text，它会转义
  draw: (value, setup, draw) => {
    if (typeof value !== 'number') return draw.text(draw.formatted)
    const track = draw.width - 64
    const y = draw.height / 2 - 2
    const ratio = Math.min(1, Math.max(0, value))
    return (
      `<rect x="8" y="${y}" width="${track}" height="4" rx="2" fill="${draw.color('var(--dou-color-bg-muted)')}"/>` +
      `<rect x="8" y="${y}" width="${track * ratio}" height="4" rx="2" fill="${draw.color('var(--dou-color-neutral)')}"/>` +
      draw.text(
        draw.formatted,
        { x: draw.width - 48, y: 0, width: 48, height: draw.height },
        {
          align: 'right',
          color: draw.color('var(--dou-color-text-secondary)'),
        },
      )
    )
  },
})

/** 进度不到一半的行，在单元格这一层画一条浅红色的底，跟着滚动，不盖住表头。 */
const Lagging = defineComponent(() => {
  const sheet = useSheet()
  return () =>
    h(
      'div',
      sheet.sheet.value.cells.flatMap((line, row) => {
        const cell = line?.[2]
        const value = typeof cell === 'object' && cell ? cell.value : undefined
        if (typeof value !== 'number' || value >= 0.5) return []
        const rect = sheet.rangeRect({ top: row, left: 0, bottom: row, right: 3 })
        if (!rect) return []
        return [
          h('div', {
            key: row,
            class: 'lagging-row',
            style: {
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            },
          }),
        ]
      }),
    )
})

// 每次修改后记下有未保存的内容；协同编辑里别人的修改 meta.origin 是 'remote'，不算
const unsaved = ref(false)
const extensions = [
  defineSheetExtension({
    name: 'project',
    cellTypes: [progress],
    layers: { below: [Lagging] },
    update: ({ transaction }) => {
      if (transaction && transaction.meta.origin !== 'remote') unsaved.value = true
    },
  }),
]

const head = (value: string) => ({ value, style: 'head' })
const row = (name: string, owner: string, ratio: number) => [
  name,
  owner,
  { value: ratio, type: 'progress' },
]
const book = ref<SheetWorkbook>({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '进度',
      colCount: 5,
      rowCount: 12,
      colSizes: { 0: 160, 2: 160 },
      cells: [
        [head('阶段'), head('负责人'), head('进度')],
        row('需求整理', '戴兜', 1),
        row('交互稿', '戴兜', 0.8),
        row('前端开发', '阿青', 0.45),
        row('测试', '小林', 0),
      ],
    },
  ],
})
const status = computed(() => (unsaved.value ? '有未保存的修改' : '已保存'))
</script>

<template>
  <div class="hooks-demo">
    <div class="hooks-demo__bar">
      <DouTag :tone="unsaved ? 'warning' : 'success'">{{ status }}</DouTag>
      <DouButton size="sm" :disabled="!unsaved" @click="unsaved = false">保存</DouButton>
    </div>
    <!-- 改几个进度试试；从导出菜单存成图片，进度条按 draw 画出来 -->
    <DouSheet v-model="book" :extensions="extensions" style="height: 280px">
      <template #header>
        <DouSheetToolbar :tools="['undo', 'redo', '|', 'bold', 'italic', '|', 'export']" />
      </template>
    </DouSheet>
  </div>
</template>

<style scoped>
.hooks-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hooks-demo__bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
:deep(.lagging-row) {
  position: absolute;
  background-color: color-mix(in oklab, var(--dou-color-danger) 8%, transparent);
}
:deep(.progress-cell) {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
:deep(.progress-cell__track) {
  flex: 1;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background-color: var(--dou-color-bg-muted);
}
:deep(.progress-cell__bar) {
  display: block;
  height: 100%;
  border-radius: inherit;
  background-color: var(--dou-color-neutral);
}
:deep(.progress-cell__text) {
  flex: none;
  width: 40px;
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
