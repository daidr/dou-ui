<script setup lang="ts">
import {
  DouSheet,
  DouSheetToolbar,
  defineSheetCellType,
  defineSheetCommand,
  defineSheetExtension,
  type SheetCellRenderProps,
  type SheetWorkbook,
} from '@dou-ui/sheet'
import { CalendarIcon, CheckIcon } from '@dou-ui/icons'
import { defineComponent, h, ref } from 'vue'

/** 进度：0 到 1 的数字，画成一条细进度条，输入 60 或 60% 都记为 0.6；编辑时显示 60%。 */
const ProgressBar = defineComponent<SheetCellRenderProps>(
  (props) => () => {
    // 不是数字（比如输入了文字）时只显示文字
    if (typeof props.value !== 'number') return h('span', { class: 'dou-sheet__text' }, props.text)
    const ratio = Math.min(1, Math.max(0, props.value))
    return h('span', { class: 'progress-cell' }, [
      h('span', { class: 'progress-cell__track' }, [
        h('span', { class: 'progress-cell__bar', style: { width: `${ratio * 100}%` } }),
      ]),
      h('span', { class: 'progress-cell__text' }, props.text),
    ])
  },
  { props: ['value', 'text', 'setup', 'readonly'] },
)

const progress = defineSheetExtension({
  name: 'progress',
  cellTypes: [
    defineSheetCellType({
      name: 'progress',
      parse: (text) => {
        const n = Number.parseFloat(text)
        // 不是数字时返回 undefined，按普通单元格读，原样存成文字
        return Number.isNaN(n) ? undefined : { value: Math.min(1, Math.max(0, n / 100)) }
      },
      // 文字不是进度，照常显示
      format: (value) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : undefined),
      valid: (value) => typeof value === 'number' || '进度要填 0 到 1 之间的数字',
      render: ProgressBar,
    }),
  ],
  // 进度单元格的右键菜单里加一项“标为完成”，作用于选中的所有进度单元格
  contextMenu: ({ active, cellType, forEachSelected, transact }) =>
    cellType(active.value)?.name === 'progress'
      ? [
          {
            key: 'done',
            label: '标为完成',
            icon: CheckIcon,
            run: () =>
              transact((tr) =>
                forEachSelected((point) => {
                  if (cellType(point)?.name === 'progress') tr.updateCell(point, { value: 1 })
                }),
              ),
          },
        ]
      : [],
})

const pad = (n: number) => String(n).padStart(2, '0')

/** 填入今天的日期：工具栏按钮、右键菜单（手机上长按）和 Ctrl / ⌘ + ; 都运行同一个命令。 */
function today() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const todayExtension = defineSheetExtension({
  name: 'today',
  commands: {
    'today.insert': defineSheetCommand({
      label: '填入今天',
      icon: CalendarIcon,
      shortcut: 'mod+;',
      enabled: ({ readonly }) => !readonly.value,
      run: ({ active, transact }) =>
        void transact((tr) => tr.updateCell(active.value, { value: today() })),
    }),
  },
  keymap: () => ({ 'mod+;': 'today.insert' }),
  contextMenu: () => [{ key: 'today', command: 'today.insert' }],
  toolbar: () => [{ key: 'today', command: 'today.insert' }],
})

const extensions = [progress, todayExtension]

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
      colSizes: { 0: 160, 2: 140, 3: 120 },
      cells: [
        [head('阶段'), head('负责人'), head('进度'), head('更新日期')],
        row('需求整理', '戴兜', 1),
        row('交互稿', '戴兜', 0.8),
        row('前端开发', '阿青', 0.45),
        row('测试', '小林', 0),
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" :extensions="extensions" style="height: 280px">
    <template #header>
      <DouSheetToolbar :tools="['undo', 'redo', '|', 'bold', 'italic', '|', 'today']" />
    </template>
  </DouSheet>
</template>

<style scoped>
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
  width: 32px;
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
