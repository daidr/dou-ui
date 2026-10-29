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
} from 'dou-ui'

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

export const cases: Record<string, Case> = {
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
}
