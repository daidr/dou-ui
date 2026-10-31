import { h, nextTick, reactive, ref, shallowRef } from 'vue'
import type { VNode } from 'vue'
import {
  DouButton,
  DouCascader,
  DouCheckbox,
  DouCommand,
  DouEllipsis,
  DouInput,
  DouListbox,
  DouSelect,
  DouTable,
  DouTag,
  DouTooltip,
  DouTransfer,
  DouTree,
  DouTreeSelect,
  DouAutocomplete,
  DouMenu,
  DouTimeline,
  DouTimelineItem,
  DouDatePicker,
  DouVirtualList,
  DouChatList,
  DouChatBubble,
  DouForm,
  DouFormItem,
  DouInputNumber,
  DouRadio,
  DouRadioGroup,
  DouSwitch,
  DouTextarea,
} from 'dou-ui'
import {
  DouGantt,
  computeCriticalPath,
  computeSchedule,
  type GanttExpose,
  type GanttLink,
  type GanttTask,
} from '@dou-ui/gantt'
import '@dou-ui/gantt/style.css'
import {
  DouChart,
  DouChartAxis,
  DouChartBar,
  DouChartLine,
  DouChartRange,
  DouChartScatter,
  DouChartZoom,
} from '@dou-ui/chart'
import '@dou-ui/chart/style.css'
import { DouFlowEditor, type FlowDocument } from '@dou-ui/flow'
import '@dou-ui/flow/style.css'
import { CodeText, DouCodeEditor, type CodeEditorExpose, typescript } from '@dou-ui/code'
import '@dou-ui/code/style.css'
import { DouSheet, type SheetExpose, type SheetWorkbook } from '@dou-ui/sheet'
import '@dou-ui/sheet/style.css'
import { DouPivot, type PivotCollapsed, type PivotConfig } from '@dou-ui/pivot'
import '@dou-ui/pivot/style.css'
import {
  DouFormBuilder,
  DouFormRenderer,
  type FormDocument,
  type FormFieldNode,
  type FormNode,
  type FormSectionNode,
} from '@dou-ui/form-builder'
import '@dou-ui/form-builder/style.css'

export interface Case {
  /** What the case renders, given a size. */
  render: (n: number) => () => VNode
  /** An interaction measured after mounting. */
  act?: (root: HTMLElement) => unknown
  /** Untimed setup before `act`. */
  prepare?: (root: HTMLElement) => unknown
  /**
   * For what happens frame after frame (a drag, a pointer moving, data
   * coming in): how many times `act` runs. The first, which fills caches,
   * is left out; the result is the median of the rest.
   */
  frames?: number
  /**
   * The most `act` may take, in ms, at each size: `bun run bench:check`
   * runs the cases that have one, at those sizes, and fails above it.
   * About twice what a laptop takes, so a slower machine passes: it
   * catches a change that makes the case several times slower, not a
   * few percent.
   */
  budget?: Record<number, number>
}

const words = ['上海', '北京', '杭州', '深圳', '成都', '南京', '武汉', '西安']
const label = (index: number) => `${words[index % words.length]} 选项 ${index}`

const options = (n: number) =>
  Array.from({ length: n }, (_, index) => ({ value: index, label: label(index) }))

/** A tree of `n` nodes, three levels deep, ten children per branch. */
function treeData(n: number) {
  const roots: any[] = []
  for (let index = 0; index < n; index++) {
    const node = { key: String(index), label: `节点 ${index}`, children: undefined as any }
    if (index % 111 === 0) roots.push(((node.children = []), node))
    else if ((index % 111) % 11 === 1) roots.at(-1).children.push(((node.children = []), node))
    else roots.at(-1).children.at(-1).children.push(node)
  }
  return roots
}

function mousedown(el: Element | null) {
  el?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
}
function input(el: HTMLInputElement | null, value: string) {
  if (!el) return
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const field = (root: HTMLElement, name: string) => root.querySelector(`.dou-${name}`)

const columns = Array.from({ length: 8 }, (_, index) => ({
  key: `c${index}`,
  title: `列 ${index}`,
}))
const rows = (n: number) =>
  Array.from({ length: n }, (_, index) => {
    const row: Record<string, unknown> = { id: index }
    for (let column = 0; column < 8; column++) row[`c${column}`] = `${label(index)}-${column}`
    return row
  })

/** The date of a working day, counted from Monday 2026-01-05. */
function workday(index: number) {
  const offset = Math.floor(index / 5) * 7 + (index % 5)
  return new Date(Date.UTC(2026, 0, 5 + offset)).toISOString().slice(0, 10)
}

/**
 * A plan of `n` tasks: a summary for every 20, its 19 tasks two working
 * days each, one after another, and each group waiting on the one before.
 */
function plan(n: number) {
  const tasks: GanttTask[] = []
  const links: GanttLink[] = []
  let parent = ''
  for (let index = 0; index < n; index++) {
    const place = index % 20
    const group = Math.floor(index / 20)
    if (place === 0) {
      parent = `g${index}`
      tasks.push({ id: parent, title: `${words[group % words.length]} 阶段 ${group}` })
      if (index) links.push({ id: `k${index}`, from: `t${index - 1}`, to: `t${index + 1}` })
      continue
    }
    const start = group * 38 + (place - 1) * 2
    tasks.push({
      id: `t${index}`,
      parent,
      title: `任务 ${index}`,
      start: workday(start),
      end: workday(start + 1),
    })
    if (place > 1) links.push({ id: `l${index}`, from: `t${index - 1}`, to: `t${index}` })
  }
  return { tasks, links }
}

const drawn = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

/**
 * Runs `change`, then waits for the frame it is drawn in: the time taken
 * is the change itself, the updates after it, and the frame callbacks the
 * change asked for (the chart draws in one), not the wait for the frame.
 * A callback asked for before the change runs first in that frame, one
 * asked for after it runs last: the time between them is the frame's work.
 */
async function timedDraw(change: () => void) {
  let frameStart = 0
  requestAnimationFrame(() => (frameStart = performance.now()))
  const start = performance.now()
  change()
  await nextTick()
  const updates = performance.now() - start
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => {
      ;(window as any).workTime = updates + (performance.now() - frameStart)
      resolve()
    }),
  )
}

/** Moves the pointer a little each frame of a hover case. */
let moves = 0

function chartCase(n: number, series: 'line' | 'bar' | 'scatter' = 'line', zoom = false) {
  let seed = 1
  const points = () => {
    const list = Array.from({ length: n })
    let value = 50
    for (let i = 0; i < n; i++) {
      seed = (seed * 16807) % 2147483647
      value += (seed / 2147483647 - 0.5) * 2
      list[i] = { t: i * 1000, v: value, x: (seed % 100_000) / 1000 }
    }
    return list
  }
  const data = shallowRef(points())
  // a tenth of the time shown, from the middle
  const range = shallowRef<[number, number] | null>(zoom ? [n * 450, n * 550] : null)
  ;(window as any).chart = { data, points, range }
  return () =>
    h('div', { class: 'chart-frame', style: 'width: 1200px' }, [
      h(DouChart, { data: data.value, x: series === 'scatter' ? 'x' : 't', height: 400 }, () =>
        series === 'scatter'
          ? [h(DouChartScatter, { y: 'v' })]
          : [
              h(DouChartAxis, { for: 'x', type: 'time' }),
              series === 'bar' ? h(DouChartBar, { y: 'v' }) : h(DouChartLine, { y: 'v' }),
              ...(zoom
                ? [
                    h(DouChartZoom, {
                      x: range.value,
                      'onUpdate:x': (v: any) => (range.value = v),
                    }),
                    h(DouChartRange),
                  ]
                : []),
            ],
      ),
    ])
}

function gantt(n: number, props: Record<string, unknown> = {}) {
  const { tasks, links } = plan(n)
  const state = { tasks: ref(tasks), links: ref(links) }
  const chart = ref<GanttExpose>()
  ;(window as any).gantt = { chart, state }
  return () =>
    h(DouGantt, {
      ref: chart,
      tasks: state.tasks.value,
      'onUpdate:tasks': (value: GanttTask[]) => (state.tasks.value = value),
      links: state.links.value,
      'onUpdate:links': (value: GanttLink[]) => (state.links.value = value),
      style: 'height: 600px',
      ...props,
    })
}

const sentence = '今天在上海讨论了组件库的虚拟滚动方案，'
const messages = (n: number) =>
  Array.from({ length: n }, (_, index) => ({
    id: index,
    role: index % 2 ? 'assistant' : 'user',
    text: `#${index} ` + sentence.repeat(1 + ((index * 7) % 9)),
  }))

export const cases: Record<string, Case> = {
  'virtual-measured': {
    render: (n) => {
      const items = messages(n)
      return () =>
        h(
          DouVirtualList,
          { items, itemKey: 'id', height: 400, style: 'width: 360px' },
          {
            default: ({ item }: any) =>
              h('div', { style: 'padding: 8px; border-bottom: 1px solid #ddd' }, item.text),
          },
        )
    },
  },
  'chat-items': {
    render: (n) => {
      const items = ref(messages(n))
      ;(window as any).prepend = () => {
        const first = items.value[0]!.id
        items.value = [
          ...messages(20).map((m) => ({ ...m, id: first - 20 + m.id })),
          ...items.value,
        ]
      }
      ;(window as any).append = () => {
        const last = items.value.at(-1)!.id
        items.value = [
          ...items.value,
          { id: last + 1, role: 'assistant', text: sentence.repeat(6) },
        ]
      }
      return () =>
        h(
          DouChatList,
          { items: items.value, itemKey: 'id', style: 'height: 500px; width: 480px' },
          {
            item: ({ item }: any) =>
              h(
                DouChatBubble,
                { placement: item.role === 'user' ? 'end' : 'start' },
                () => item.text,
              ),
          },
        )
    },
  },
  'chat-plain': {
    render: (n) => {
      const items = messages(n)
      return () =>
        h(DouChatList, { style: 'height: 500px; width: 480px' }, () =>
          items.map((item) =>
            h(
              DouChatBubble,
              { key: item.id, placement: item.role === 'user' ? 'end' : 'start' },
              () => item.text,
            ),
          ),
        )
    },
  },
  /* per-instance cost of plain components */
  button: {
    render: (n) => () =>
      h(
        'div',
        Array.from({ length: n }, (_, i) => h(DouButton, null, () => `按钮 ${i}`)),
      ),
  },
  input: {
    render: (n) => () =>
      h(
        'div',
        Array.from({ length: n }, () => h(DouInput)),
      ),
  },
  checkbox: {
    render: (n) => () =>
      h(
        'div',
        Array.from({ length: n }, (_, i) => h(DouCheckbox, null, () => label(i))),
      ),
  },
  tag: {
    render: (n) => () =>
      h(
        'div',
        Array.from({ length: n }, (_, i) => h(DouTag, null, () => label(i))),
      ),
  },
  tooltip: {
    render: (n) => () =>
      h(
        'div',
        Array.from({ length: n }, (_, i) =>
          h(DouTooltip, { content: label(i) }, () => h('span', label(i))),
        ),
      ),
  },
  ellipsis: {
    render: (n) => () =>
      h(
        'div',
        { style: 'width: 120px' },
        Array.from({ length: n }, (_, i) => h(DouEllipsis, null, () => `${label(i)} ${label(i)}`)),
      ),
  },
  'ellipsis-tooltip': {
    render: (n) => () =>
      h(
        'div',
        { style: 'width: 120px' },
        Array.from({ length: n }, (_, i) =>
          h(DouEllipsis, { tooltip: true }, () => `${label(i)} ${label(i)}`),
        ),
      ),
  },

  /* lists */
  select: {
    render: (n) => {
      const list = options(n)
      return () => h(DouSelect, { options: list, teleport: false })
    },
    act: (root) => mousedown(field(root, 'select')),
  },
  'select-groups': {
    render: (n) => {
      const groups = Array.from({ length: 4 }, (_, g) => ({
        label: `分组 ${g}`,
        options: options(n / 4).map((o) => ({ value: `${g}-${o.value}`, label: o.label })),
      }))
      return () => h(DouSelect, { options: groups, teleport: false })
    },
    act: (root) => mousedown(field(root, 'select')),
  },
  'select-virtual': {
    render: (n) => {
      const list = options(n)
      return () => h(DouSelect, { options: list, virtual: true, teleport: false })
    },
    act: (root) => mousedown(field(root, 'select')),
  },
  'select-hover': {
    render: (n) => {
      const list = options(n)
      return () => h(DouSelect, { options: list, teleport: false })
    },
    prepare: (root) => mousedown(field(root, 'select')),
    act: (root) =>
      root
        .querySelectorAll('[role="option"]')[3]
        ?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })),
  },
  'cascader-hover': {
    render: (n) => {
      const list = options(n).map((o) => ({ ...o, children: options(5) }))
      return () => h(DouCascader, { options: list, teleport: false, expandTrigger: 'hover' })
    },
    prepare: (root) => mousedown(field(root, 'cascader')),
    act: (root) =>
      root
        .querySelectorAll('[role="option"]')[3]
        ?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false })),
  },
  'select-filter': {
    render: (n) => {
      const list = options(n)
      return () => h(DouSelect, { options: list, filterable: true, teleport: false })
    },
    prepare: (root) => mousedown(field(root, 'select')),
    act: (root) => input(root.querySelector('input'), '上'),
  },
  'select-multiple': {
    render: (n) => {
      const list = options(n)
      const value = ref(list.slice(0, Math.min(200, n)).map((o) => o.value))
      return () =>
        h(DouSelect, {
          options: list,
          multiple: true,
          teleport: false,
          modelValue: value.value,
          'onUpdate:modelValue': (v: any) => (value.value = v),
        })
    },
    act: (root) => mousedown(field(root, 'select')),
  },
  cascader: {
    render: (n) => {
      const list = options(n).map((o) => ({ ...o, children: options(5) }))
      return () => h(DouCascader, { options: list, teleport: false })
    },
    act: (root) => mousedown(field(root, 'cascader')),
  },
  'cascader-multiple': {
    render: (n) => {
      const list = options(n).map((o) => ({ ...o, children: options(5) }))
      return () => h(DouCascader, { options: list, multiple: true, teleport: false })
    },
    act: (root) => mousedown(field(root, 'cascader')),
  },
  'tree-select': {
    render: (n) => {
      const data = treeData(n)
      return () => h(DouTreeSelect, { data, defaultExpandAll: true, teleport: false })
    },
    act: (root) => mousedown(field(root, 'tree-select')),
  },
  autocomplete: {
    render: (n) => {
      const list = options(n).map((o) => ({ value: o.label }))
      const value = ref('')
      return () =>
        h(DouAutocomplete, {
          options: list,
          teleport: false,
          debounce: 0,
          modelValue: value.value,
          'onUpdate:modelValue': (v: string) => (value.value = v),
        })
    },
    prepare: (root) => root.querySelector('input')!.focus(),
    act: (root) => input(root.querySelector('input'), '上'),
  },
  tree: {
    render: (n) => {
      const data = treeData(n)
      return () => h(DouTree, { data, defaultExpandAll: true })
    },
  },
  'tree-virtual': {
    render: (n) => {
      const data = treeData(n)
      return () => h(DouTree, { data, defaultExpandAll: true, height: 400 })
    },
  },
  'tree-checkable': {
    render: (n) => {
      const data = treeData(n)
      return () => h(DouTree, { data, defaultExpandAll: true, checkable: true, height: 400 })
    },
    act: (root) => (root.querySelector('.dou-tree__checkbox') as HTMLElement)?.click(),
  },
  listbox: {
    render: (n) => {
      const list = options(n)
      return () => h(DouListbox, { options: list, maxHeight: 300 })
    },
  },
  'listbox-groups': {
    render: (n) => {
      const groups = Array.from({ length: 4 }, (_, g) => ({
        label: `分组 ${g}`,
        options: options(n / 4).map((o) => ({
          value: `${g}-${o.value}`,
          label: o.label,
          description: o.value % 3 === 0 ? `说明 ${o.value}` : undefined,
        })),
      }))
      return () => h(DouListbox, { options: groups, maxHeight: 300, filterable: true })
    },
  },
  'command-groups': {
    render: (n) => {
      const items = options(n).map((o) => ({ ...o, group: `分组 ${o.value % 4}` }))
      return () => h(DouCommand, { items, maxHeight: 300 })
    },
  },
  command: {
    render: (n) => {
      const items = options(n)
      return () => h(DouCommand, { items, maxHeight: 300 })
    },
    act: (root) => input(root.querySelector('input'), '上'),
  },
  transfer: {
    render: (n) => {
      const data = options(n).map((o) => ({ key: o.value, label: o.label }))
      const value = ref<(string | number)[]>([])
      return () =>
        h(DouTransfer, {
          data,
          filterable: true,
          modelValue: value.value,
          'onUpdate:modelValue': (v: (string | number)[]) => (value.value = v),
        })
    },
    act: (root) => input(root.querySelector('.dou-input input'), '上'),
  },
  table: {
    render: (n) => {
      const data = rows(n)
      return () => h(DouTable, { data, columns, rowKey: 'id' })
    },
  },
  'table-sortable': {
    render: (n) => {
      const data = rows(n)
      const cols = columns.map((c) => ({ ...c, sortable: true }))
      return () => h(DouTable, { data, columns: cols, rowKey: 'id', selectable: true })
    },
    act: (root) => (root.querySelector('th button, th [role="button"]') as HTMLElement)?.click(),
  },
  'table-select-row': {
    render: (n) => {
      const data = rows(n)
      const selected = ref<(string | number)[]>([])
      return () =>
        h(DouTable, {
          data,
          columns,
          rowKey: 'id',
          selectable: true,
          selected: selected.value,
          'onUpdate:selected': (v: (string | number)[]) => (selected.value = v),
        })
    },
    act: (root) => (root.querySelectorAll('tbody .dou-checkbox input')[3] as HTMLElement)?.click(),
  },
  'table-ellipsis': {
    render: (n) => {
      const data = rows(n)
      const cols = columns.map((c) => ({ ...c, ellipsis: true, width: 120 }))
      return () => h(DouTable, { data, columns: cols, rowKey: 'id' })
    },
  },
  'table-virtual': {
    render: (n) => {
      const data = rows(n)
      return () => h(DouTable, { data, columns, rowKey: 'id', virtual: true, maxHeight: 500 })
    },
  },
  'table-virtual-measured': {
    render: (n) => {
      const data = Array.from({ length: n }, (_, index) => ({
        id: index,
        name: `订单 ${index}`,
        note: sentence.repeat(1 + ((index * 5) % 4)),
      }))
      const expanded = ref<(string | number)[]>([3])
      ;(window as any).expandRow = (key: number) => (expanded.value = [...expanded.value, key])
      ;(window as any).collapseAll = () => (expanded.value = [])
      return () =>
        h(
          DouTable,
          {
            data,
            rowKey: 'id',
            virtual: true,
            maxHeight: 500,
            style: 'width: 640px',
            expandable: true,
            columns: [
              { key: 'name', title: '名称', width: 120 },
              { key: 'note', title: '备注' },
            ],
            expanded: expanded.value,
            'onUpdate:expanded': (value: (string | number)[]) => (expanded.value = value),
          },
          { expand: ({ row }: any) => h('div', { style: 'height: 120px' }, `详情：${row.name}`) },
        )
    },
  },
  menu: {
    render: (n) => {
      const items = options(n).map((o) => ({ key: String(o.value), label: o.label }))
      return () => h(DouMenu, { items })
    },
  },
  timeline: {
    render: (n) => {
      return () =>
        h(DouTimeline, null, () =>
          Array.from({ length: n }, (_, i) => h(DouTimelineItem, { title: label(i) })),
        )
    },
  },
  'date-picker': {
    render: (n) => () =>
      h(
        'div',
        Array.from({ length: n }, () => h(DouDatePicker, { teleport: false })),
      ),
    act: (root) => mousedown(field(root, 'date-picker')),
  },
  // a time series of `n` points; the canvas is drawn in the next frame, so `act` waits for it
  chart: {
    budget: { 1_000_000: 200 },
    render: (n) => chartCase(n),
    // new data: read into columns again and drawn
    prepare: () => {
      const state = (window as any).chart
      state.next = state.points()
    },
    act: async () => {
      const { data, next } = (window as any).chart
      await timedDraw(() => (data.value = next))
    },
  },
  // `n` bars, most narrower than a pixel: merged per pixel column
  'chart-bar': {
    render: (n) => chartCase(n, 'bar'),
    prepare: () => {
      const state = (window as any).chart
      state.next = state.points()
    },
    act: async () => {
      const { data, next } = (window as any).chart
      await timedDraw(() => (data.value = next))
    },
  },
  // `n` points scattered over the plot: dots on one pixel drawn once
  'chart-scatter': {
    render: (n) => chartCase(n, 'scatter'),
    prepare: () => {
      const state = (window as any).chart
      state.next = state.points()
    },
    act: async () => {
      const { data, next } = (window as any).chart
      await timedDraw(() => (data.value = next))
    },
  },
  // zoomed in to a tenth of `n` points: a step of the pan, as a drag or the wheel moves it
  'chart-pan': {
    frames: 20,
    budget: { 1_000_000: 16 },
    render: (n) => chartCase(n, 'line', true),
    act: async () => {
      const { range } = (window as any).chart
      const [a, b] = range.value.map(Number)
      const step = (b - a) / 50
      await timedDraw(() => (range.value = [a + step, b + step]))
    },
  },
  // new data given by column, as typed arrays: nothing to read row by row
  'chart-columns': {
    budget: { 1_000_000: 120 },
    render: (n) => chartCase(n),
    prepare: () => {
      const state = (window as any).chart
      const points = state.points()
      const t = new Float64Array(points.length)
      const v = new Float64Array(points.length)
      for (let i = 0; i < points.length; i++) {
        t[i] = points[i].t
        v[i] = points[i].v
      }
      state.next = { t, v }
    },
    act: async () => {
      const { data, next } = (window as any).chart
      await timedDraw(() => (data.value = next))
    },
  },
  // a live line of the last `n` points: one comes in, the oldest goes
  'chart-live': {
    frames: 20,
    budget: { 10_000: 8 },
    render: (n) => chartCase(n),
    act: async () => {
      const { data } = (window as any).chart
      const shown = data.value
      const last = shown[shown.length - 1]
      await timedDraw(() => {
        const next = shown.slice(1)
        next.push({ t: last.t + 1000, v: last.v + Math.sin(last.t) * 0.5, x: 0 })
        data.value = next
      })
    },
  },
  // all of `n` points shown, zoomed in by a step
  'chart-zoom': {
    frames: 20,
    budget: { 1_000_000: 16 },
    render: (n) => chartCase(n, 'line', true),
    prepare: () => {
      ;(window as any).chart.range.value = null
    },
    act: async () => {
      const { range } = (window as any).chart
      const n = (window as any).chart.data.value.length
      await timedDraw(() => (range.value = [n * 50, n * 950]))
    },
  },
  // the pointer over `n` points: the x under it found, the tooltip shown
  'chart-hover': {
    frames: 20,
    budget: { 1_000_000: 8 },
    render: (n) => chartCase(n),
    act: async (root) => {
      const el = root.querySelector<HTMLElement>('.dou-chart')!
      const box = el.getBoundingClientRect()
      await timedDraw(() =>
        el.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            clientX: box.left + box.width * (0.6 + (moves++ % 20) / 100),
            clientY: box.top + 200,
            pointerType: 'mouse',
          }),
        ),
      )
    },
  },
  // the pointer over `n` scattered points: the nearest found
  'chart-scatter-hover': {
    frames: 20,
    budget: { 100_000: 4, 1_000_000: 8 },
    render: (n) => chartCase(n, 'scatter'),
    act: async (root) => {
      const el = root.querySelector<HTMLElement>('.dou-chart')!
      const box = el.getBoundingClientRect()
      await timedDraw(() =>
        el.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            clientX: box.left + box.width * (0.6 + (moves++ % 20) / 100),
            clientY: box.top + 200,
            pointerType: 'mouse',
          }),
        ),
      )
    },
  },
  'chart-resize': {
    render: (n) => chartCase(n),
    // the same data at another width: only laid out and drawn again
    act: async (root) => {
      root.querySelector<HTMLElement>('.chart-frame')!.style.width = '1000px'
      await drawn()
    },
  },
  gantt: {
    render: (n) => gantt(n),
    // a step to the right, which renders the newly seen days
    act: (root) => {
      const chart = root.querySelector('.dou-gantt__chart')!
      chart.scrollLeft += 2000
      chart.dispatchEvent(new Event('scroll'))
    },
  },
  'gantt-critical': {
    render: (n) => gantt(n, { critical: true }),
  },
  'gantt-auto': {
    render: (n) => gantt(n, { scheduling: 'auto' }),
    // a week later for the first task: every task after it is pushed
    act: () => {
      const { chart } = (window as any).gantt
      chart.value.transact((tr: any) => tr.setSpan('t1', '2026-01-12', '2026-01-13'))
    },
  },
  'gantt-schedule': {
    render: (n) => gantt(n),
    act: () => {
      const { state } = (window as any).gantt
      const doc = { tasks: state.tasks.value, links: state.links.value }
      computeSchedule(
        {
          ...doc,
          tasks: doc.tasks.map((t: GanttTask) =>
            t.id === 't1' ? { ...t, start: '2026-01-12', end: '2026-01-13' } : t,
          ),
        },
        { fixed: ['t1'] },
      )
    },
  },
  'gantt-critical-path': {
    render: (n) => gantt(n),
    act: () => {
      const { state } = (window as any).gantt
      computeCriticalPath({ tasks: state.tasks.value, links: state.links.value })
    },
  },
  // A flow of n nodes in a grid and about 1.6 edges per node, most of it off screen.
  flow: {
    render: (n) => flowEditor(n),
    // Scroll across the canvas.
    act: (root) => wheel(root, 600, 400),
  },
  // A form of `n` fields of mixed types in sections of 10, two columns wide.
  'form-renderer': {
    render: (n) => formRenderer(n),
    // Type into a field in the middle; only it should re-render.
    act: (root) => {
      const inputs = root.querySelectorAll<HTMLInputElement>('.dou-input input')
      input(inputs[inputs.length >> 1] ?? null, '戴兜')
    },
  },
  // The same form with logic: in each group, the other fields show, turn
  // required and work out a formula from the group's first text field.
  // Typing in the middle group's one reruns only that group's expressions.
  'form-logic': {
    render: (n) => formLogic(n),
    act: (root) => {
      const gate = logicGates[logicGates.length >> 1]
      input(root.querySelector<HTMLInputElement>(`[data-node="${gate}"] input`), '戴兜')
    },
  },
  // The builder opening the same form; then a press selects a field in the
  // middle, which shows its settings.
  'form-builder': {
    render: (n) => formBuilder(n),
    act: (root) => {
      const nodes = root.querySelectorAll<HTMLElement>('.dou-form-builder__node:not(.is-container)')
      nodes[nodes.length >> 1]?.click()
    },
  },
  // Changing the selected field's label: one transaction with its undo record.
  'form-builder-edit': {
    render: (n) => formBuilder(n),
    prepare: (root) => {
      const nodes = root.querySelectorAll<HTMLElement>('.dou-form-builder__node:not(.is-container)')
      nodes[nodes.length >> 1]?.click()
    },
    act: () => {
      const builder = (window as any).formBuilder
      builder.dispatch(builder.transaction().update(builder.selection[0], { label: '戴兜' }))
    },
  },
  // The same form written by hand, for the cost of the renderer itself.
  'form-handwritten': {
    render: (n) => formHandwritten(n),
  },
  'flow-zoomed-out': {
    render: (n) => flowEditor(n, 0.2),
    act: (root) => wheel(root, 300, 200),
  },
  // A code file of n lines bound as a string: open it, then scroll to the middle.
  code: {
    render: (n) => codeEditor(n, 'string'),
    act: (root) => {
      const scroller = root.querySelector('.dou-code-editor__scroller')!
      scroller.scrollTop = scroller.scrollHeight / 2
      scroller.dispatchEvent(new Event('scroll'))
    },
  },
  // One frame of a wheel: only the lines coming into view are drawn.
  'code-scroll-step': {
    render: (n) => codeEditor(n, 'string'),
    act: (root) => {
      const scroller = root.querySelector('.dou-code-editor__scroller')!
      scroller.scrollTop += 60
      scroller.dispatchEvent(new Event('scroll'))
    },
  },
  // One key typed in the middle, handing the whole string back through v-model.
  'code-type': {
    render: (n) => codeEditor(n, 'string'),
    prepare: (root) => codeCursor(root, 1),
    act: (root) => codeType(root, 'x'),
  },
  // The same key with v-model:doc: no string is joined.
  'code-type-doc': {
    render: (n) => codeEditor(n, 'doc'),
    prepare: (root) => codeCursor(root, 1),
    act: (root) => codeType(root, 'x'),
  },
  // One key typed at a thousand cursors at once.
  'code-cursors': {
    render: (n) => codeEditor(n, 'doc'),
    prepare: (root) => codeCursor(root, 1000),
    act: (root) => codeType(root, 'x'),
  },
  // Highlighted as TypeScript: one frame of a wheel reads and colors only the lines coming in.
  'code-syntax-scroll-step': {
    render: (n) => codeEditor(n, 'doc', true),
    act: (root) => {
      const scroller = root.querySelector('.dou-code-editor__scroller')!
      scroller.scrollTop += 60
      scroller.dispatchEvent(new Event('scroll'))
    },
  },
  // A key typed in highlighted code: the line is read again, and reading stops at the next.
  'code-syntax-type': {
    render: (n) => codeEditor(n, 'doc', true),
    prepare: (root) => {
      const editor = (window as any).codeEditor.value as CodeEditorExpose
      editor.select(editor.doc.line(20).from + 8)
      root.querySelector('textarea')!.focus()
    },
    act: (root) => codeType(root, 'x'),
  },
  // Opening a block comment at the top: every line in view is read and colored again.
  'code-syntax-comment': {
    render: (n) => codeEditor(n, 'doc', true),
    prepare: (root) => {
      const editor = (window as any).codeEditor.value as CodeEditorExpose
      editor.select(0)
      root.querySelector('textarea')!.focus()
    },
    act: (root) => codeType(root, '/*'),
  },
  // A sheet of n rows × 20 columns, every cell filled.
  sheet: {
    render: (n) => sheet(n),
    // Scroll a long way down and to the right.
    act: (root) => {
      const viewport = root.querySelector('.dou-sheet__viewport')!
      viewport.scrollTop = viewport.scrollHeight / 2
      viewport.scrollLeft = 600
      viewport.dispatchEvent(new Event('scroll'))
    },
  },
  // A short scroll, as one frame of a wheel: only the rows coming in are drawn.
  'sheet-scroll-step': {
    render: (n) => sheet(n),
    act: (root) => {
      const viewport = root.querySelector('.dou-sheet__viewport')!
      viewport.scrollTop += 84
      viewport.dispatchEvent(new Event('scroll'))
    },
  },
  // One cell changed: the rows that stay the same aren't copied or drawn again.
  'sheet-edit': {
    render: (n) => sheet(n),
    act: () => (window as any).sheet.value.transact((tr: any) => tr.setValue('D4', 42)),
  },
  // Typed cells (a check box and a tagged option per row) and a merge every ten rows, scrolled.
  'sheet-typed': {
    render: (n) => sheet(n, true),
    act: (root) => {
      const viewport = root.querySelector('.dou-sheet__viewport')!
      viewport.scrollTop = viewport.scrollHeight / 2
      viewport.dispatchEvent(new Event('scroll'))
    },
  },
  // Everything selected: every cell in view is drawn again with the tint.
  'sheet-select-all': {
    render: (n) => sheet(n),
    act: () => (window as any).sheet.value.select('A1:T100000'),
  },
  // n records grouped 8 × 120 cities × 4 by 4 × 12 months, two values: read, summed up and drawn.
  pivot: {
    render: (n) => pivot(n),
    // Another layout of fields already read: summed up again, nothing read again.
    act: () => {
      ;(window as any).pivot.config.value = {
        rows: ['city'],
        columns: ['region'],
        values: ['amount', { aggregate: 'count' }],
      }
    },
  },
  // Rows ordered by the grand total: no summing up again.
  'pivot-sort': {
    render: (n) => pivot(n),
    act: () => {
      const { config } = (window as any).pivot
      config.value = { ...config.value, sort: { valueIndex: 0, order: 'desc' } }
    },
  },
  // The first region closed: the rows are laid out again, not summed up.
  'pivot-toggle': {
    render: (n) => pivot(n),
    act: () => {
      ;(window as any).pivot.collapsed.value = { rows: [['华东']] }
    },
  },
  // A long way down and to the right.
  'pivot-scroll': {
    render: (n) => pivot(n),
    act: (root) => {
      const viewport = root.querySelector('.dou-pivot__viewport')!
      viewport.scrollTop = viewport.scrollHeight / 2
      viewport.scrollLeft = 800
      viewport.dispatchEvent(new Event('scroll'))
    },
  },
}

function pivot(n: number) {
  const regions = ['华东', '华南', '华北', '华中', '西南', '西北', '东北', '海外']
  const kinds = ['果茶', '奶茶', '纯茶', '咖啡']
  const records = Array.from({ length: n }, (_, i) => {
    const r = i % 8
    return {
      region: regions[r],
      city: `${regions[r]}城市 ${(i * 7) % 15}`,
      kind: kinds[(i >> 3) % 4],
      quarter: `Q${((i >> 5) % 4) + 1}`,
      month: ((i * 13) % 12) + 1,
      amount: (i * 37) % 1000,
    }
  })
  const config = ref<PivotConfig>({
    rows: ['region', 'city', 'kind'],
    columns: ['quarter', 'month'],
    values: ['amount', { aggregate: 'count' }],
  })
  const collapsed = ref<PivotCollapsed>({})
  ;(window as any).pivot = { config, collapsed }
  return () =>
    h(DouPivot, {
      data: records,
      config: config.value,
      'onUpdate:config': (value: PivotConfig) => (config.value = value),
      collapsed: collapsed.value,
      maxHeight: 600,
    })
}

function codeEditor(n: number, bind: 'string' | 'doc', highlighted = false) {
  const source = Array.from(
    { length: n },
    (_, i) => `  const value${i} = compute(${i}, '第 ${i + 1} 行') // ${i % 7 ? '' : 'note'}`,
  ).join('\n')
  const code = ref(source)
  const doc = shallowRef<CodeText | undefined>()
  const editor = ref<CodeEditorExpose>()
  ;(window as any).codeEditor = editor
  return () =>
    h(DouCodeEditor, {
      ref: editor,
      style: 'height: 600px',
      language: highlighted ? typescript : undefined,
      ...(bind === 'string'
        ? { modelValue: code.value, 'onUpdate:modelValue': (value: string) => (code.value = value) }
        : {
            doc: doc.value ?? CodeText.of(source),
            'onUpdate:doc': (value: CodeText) => (doc.value = value),
          }),
    })
}

/** Puts `count` cursors on consecutive lines around the middle of the file. */
function codeCursor(root: HTMLElement, count: number) {
  const editor = (window as any).codeEditor.value as CodeEditorExpose
  const { doc } = editor
  const first = Math.max(1, (doc.lines >> 1) - (count >> 1))
  const ranges = Array.from({ length: Math.min(count, doc.lines) }, (_, i) => {
    const pos = doc.line(first + i).from + 8
    return { anchor: pos, head: pos }
  })
  editor.select({ ranges, main: 0 })
  root.querySelector('textarea')!.focus()
}

function codeType(root: HTMLElement, text: string) {
  const textarea = root.querySelector('textarea')!
  const at = textarea.selectionStart
  textarea.value = textarea.value.slice(0, at) + text + textarea.value.slice(textarea.selectionEnd)
  textarea.setSelectionRange(at + 1, at + 1)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

function sheet(n: number, typed = false) {
  const cells = Array.from({ length: n }, (_, r) =>
    Array.from({ length: 20 }, (__, c) => (c === 0 ? `第 ${r + 1} 行` : (r * 7 + c * 13) % 1000)),
  )
  const book = ref<SheetWorkbook>({ sheets: [{ name: '表 1', cells }] })
  if (typed) {
    const choices = ['未开始', { value: '进行中', tone: 'primary' as const }, '已完成']
    book.value.types = { status: { type: 'select', options: choices } }
    for (const [r, row] of cells.entries()) {
      ;(row as unknown[])[1] = { value: r % 2 === 0, type: 'checkbox' }
      ;(row as unknown[])[2] = { value: '进行中', type: 'status' }
    }
    book.value.sheets[0]!.merges = Array.from(
      { length: Math.floor(n / 10) },
      (_, i) => `D${i * 10 + 1}:F${i * 10 + 2}`,
    )
  }
  const grid = ref<SheetExpose>()
  ;(window as any).sheet = grid
  return () =>
    h(DouSheet, {
      ref: grid,
      modelValue: book.value,
      'onUpdate:modelValue': (value: SheetWorkbook) => (book.value = value),
      style: 'height: 600px',
    })
}

function flowDocument(n: number): FlowDocument {
  const perRow = Math.ceil(Math.sqrt(n))
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    x: (i % perRow) * 280,
    y: Math.floor(i / perRow) * 120,
    data: {
      label: label(i),
      inputs: [{ id: 'in' }],
      outputs: [{ id: 'a' }, { id: 'b' }],
    },
  }))
  const edges = []
  for (let i = 0; i < n; i++) {
    if ((i + 1) % perRow)
      edges.push({
        id: `r${i}`,
        source: { node: `n${i}`, port: 'a' },
        target: { node: `n${i + 1}`, port: 'in' },
      })
    if (i + perRow + 1 < n && i % 3 !== 2)
      edges.push({
        id: `d${i}`,
        source: { node: `n${i}`, port: 'b' },
        target: { node: `n${i + perRow + 1}`, port: 'in' },
      })
  }
  return { nodes, edges }
}

function flowEditor(n: number, zoom = 1) {
  const doc = ref(flowDocument(n))
  const viewport = ref({ x: 0, y: 0, zoom })
  return () =>
    h(DouFlowEditor, {
      modelValue: doc.value,
      'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
      viewport: viewport.value,
      'onUpdate:viewport': (value: typeof viewport.value) => (viewport.value = value),
      style: 'height: 720px',
    })
}

function wheel(root: HTMLElement, x: number, y: number) {
  root
    .querySelector('.dou-flow-editor')!
    .dispatchEvent(
      new WheelEvent('wheel', { deltaX: x, deltaY: y, bubbles: true, cancelable: true }),
    )
}

const formTypes = [
  'input',
  'select',
  'input-number',
  'date-picker',
  'radio-group',
  'switch',
  'textarea',
  'input',
]

function formDocument(n: number): FormDocument {
  const sections: FormNode[] = []
  for (let index = 0; index < n; index += 10) {
    const children: FormNode[] = []
    for (let i = index; i < Math.min(n, index + 10); i++) {
      const type = formTypes[i % formTypes.length]!
      children.push({
        id: `f${i}`,
        type,
        name: `field${i}`,
        label: label(i),
        span: { md: type === 'textarea' ? 12 : 6 },
        required: i % 3 === 0,
        props:
          type === 'select' || type === 'radio-group'
            ? { options: ['上海', '北京', '杭州'] }
            : { placeholder: label(i) },
      })
    }
    sections.push({ id: `s${index}`, type: 'section', title: `第 ${index / 10 + 1} 组`, children })
  }
  return { version: 1, nodes: sections }
}

function formRenderer(n: number) {
  const form = formDocument(n)
  return () => h(DouFormRenderer, { form, style: 'max-width: 960px' })
}

function formBuilder(n: number) {
  const form = shallowRef(formDocument(n))
  return () =>
    h(DouFormBuilder, {
      ref: (instance: unknown) => ((window as any).formBuilder = instance),
      modelValue: form.value,
      'onUpdate:modelValue': (next: FormDocument) => (form.value = next),
      style: '--dou-form-builder-height: 800px',
    })
}

/** The ids of the fields the others in their group read, in `form-logic`. */
let logicGates: string[] = []

function formLogic(n: number) {
  const form = formDocument(n)
  const gates: string[] = []
  for (const section of form.nodes as FormSectionNode[]) {
    const gate = section.children.find((node) => node.type === 'input') as FormFieldNode
    gates.push(gate.id)
    const name = gate.name!
    section.children.forEach((node, index) => {
      if (node === gate) return
      node.visibleWhen = `values.${name} != '隐藏'`
      if (index % 3 === 1 && node.type !== 'switch')
        (node as FormFieldNode).requiredWhen = `len(values.${name}) > 0`
    })
    section.children.push({
      id: `${section.id}-count`,
      type: 'input-number',
      name: `${name}Length`,
      label: '字数',
      span: { md: 6 },
      formula: `len(values.${name})`,
    })
  }
  logicGates = gates
  return () => h(DouFormRenderer, { form, style: 'max-width: 960px' })
}

function formHandwritten(n: number) {
  const form = formDocument(n)
  const model = reactive<Record<string, unknown>>({})
  const control = (node: any) => {
    const value: Record<string, any> = {
      modelValue: model[node.name],
      'onUpdate:modelValue': (v: unknown) => (model[node.name] = v),
    }
    switch (node.type) {
      case 'select':
        return h(DouSelect, { ...node.props, ...value })
      case 'input-number':
        return h(DouInputNumber, { ...node.props, ...value })
      case 'date-picker':
        return h(DouDatePicker, { ...node.props, ...value })
      case 'radio-group':
        return h(DouRadioGroup, value, () =>
          node.props.options.map((option: string) => h(DouRadio, { value: option }, () => option)),
        )
      case 'switch':
        return h(DouSwitch, value)
      case 'textarea':
        return h(DouTextarea, { ...node.props, ...value })
      default:
        return h(DouInput, { ...node.props, ...value })
    }
  }
  return () =>
    h(DouForm, { model, style: 'max-width: 960px' }, () =>
      form.nodes.map((section: any) =>
        h('div', { key: section.id }, [
          h('div', section.title),
          ...section.children.map((node: any) =>
            h(
              DouFormItem,
              { key: node.id, label: node.label, prop: node.name, required: node.required },
              () => control(node),
            ),
          ),
        ]),
      ),
    )
}
