import { h, ref } from 'vue'
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
import { DouFlowEditor, type FlowDocument } from '@dou-ui/flow'
import '@dou-ui/flow/style.css'

export interface Case {
  /** What the case renders, given a size. */
  render: (n: number) => () => VNode
  /** An interaction measured after mounting. */
  act?: (root: HTMLElement) => unknown
  /** Untimed setup before `act`. */
  prepare?: (root: HTMLElement) => unknown
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
  'flow-zoomed-out': {
    render: (n) => flowEditor(n, 0.2),
    act: (root) => wheel(root, 300, 200),
  },
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
