<script setup lang="ts">
import {
  computed,
  nextTick,
  provide,
  ref,
  shallowReactive,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormSize } from '../form/use-form-item'
import { DouVirtualList } from '../virtual-list'
import { treeContextKey, treeRowHeights } from './tree'
import type { TreeExpose, TreeKey, TreeNodeData, TreeProps, TreeRow, TreeSlots } from './tree'
import TreeNode from './tree-node.vue'
import type { VirtualListExpose } from '../virtual-list'

defineOptions({ name: 'DouTree' })

const props = withDefaults(defineProps<TreeProps>(), {
  selectable: true,
  checkable: false,
  checkStrictly: false,
  defaultExpandAll: false,
  expandOnClick: false,
  guides: false,
})
const expandedModel = defineModel<TreeKey[]>('expanded')
const selectedModel = defineModel<TreeKey | null>('selected')
const checkedModel = defineModel<TreeKey[]>('checked')
const emit = defineEmits<{
  select: [node: TreeNodeData]
  check: [node: TreeNodeData, checked: boolean]
  expand: [node: TreeNodeData, expanded: boolean]
  loadError: [node: TreeNodeData, error: unknown]
}>()
const slots = defineSlots<TreeSlots>()

const ns = useNamespace('tree')
const { t } = useLocale()
const size = useFormSize(() => props.size)
const id = `dou-tree-${useId()}`

// Children fetched by `load`, kept apart from the user's data.
const loaded = shallowReactive(new Map<TreeKey, TreeNodeData[]>())
const loading = shallowReactive(new Set<TreeKey>())

const childrenOf = (node: TreeNodeData) => node.children ?? loaded.get(node.key)
const isLeaf = (node: TreeNodeData) => {
  if (node.isLeaf) return true
  const children = childrenOf(node)
  if (children) return children.length === 0
  return !props.load
}

interface Entry {
  node: TreeNodeData
  parent: TreeKey | null
  level: number
}

// Every known node by key, in tree order.
const index = computed(() => {
  const map = new Map<TreeKey, Entry>()
  const walk = (nodes: TreeNodeData[], parent: TreeKey | null, level: number) => {
    for (const node of nodes) {
      map.set(node.key, { node, parent, level })
      const children = childrenOf(node)
      if (children) walk(children, node.key, level + 1)
    }
  }
  walk(props.data, null, 1)
  return map
})

function ancestors(key: TreeKey) {
  const keys: TreeKey[] = []
  let parent = index.value.get(key)?.parent ?? null
  while (parent !== null) {
    keys.push(parent)
    parent = index.value.get(parent)?.parent ?? null
  }
  return keys
}

const branchKeys = () =>
  [...index.value.values()].filter(({ node }) => !isLeaf(node)).map(({ node }) => node.key)

if (expandedModel.value === undefined && props.defaultExpandAll) expandedModel.value = branchKeys()
const expandedSet = computed(() => new Set(expandedModel.value ?? []))

/* filtering */

const query = computed(() => props.filter?.trim() ?? '')
const matches = (node: TreeNodeData) => {
  if (props.filterMethod) return props.filterMethod(query.value, node)
  return labelOf(node).toLowerCase().includes(query.value.toLowerCase())
}
// With a filter, the nodes to keep and the branches opened to reveal them.
const filtered = computed(() => {
  if (!query.value) return null
  const keep = new Set<TreeKey>()
  const opened = new Set<TreeKey>()
  const walk = (nodes: TreeNodeData[]): boolean => {
    let any = false
    for (const node of nodes) {
      const below = walk(childrenOf(node) ?? [])
      if (below) opened.add(node.key)
      if (below || matches(node)) {
        keep.add(node.key)
        any = true
      }
    }
    return any
  }
  walk(props.data)
  return { keep, reveal: opened }
})

const isExpanded = (node: TreeNodeData) =>
  !isLeaf(node) && (expandedSet.value.has(node.key) || !!filtered.value?.reveal.has(node.key))

/* the rows on screen */

const rows = computed(() => {
  const list: TreeRow[] = []
  const keep = filtered.value?.keep
  const walk = (nodes: TreeNodeData[], level: number) => {
    const shown = keep ? nodes.filter((node) => keep.has(node.key)) : nodes
    shown.forEach((node, position) => {
      const expanded = isExpanded(node)
      list.push({
        node,
        key: node.key,
        level,
        setSize: shown.length,
        position: position + 1,
        expandable: !isLeaf(node),
        expanded,
      })
      const children = childrenOf(node)
      if (expanded && children) walk(children, level + 1)
    })
  }
  walk(props.data, 1)
  return list
})
const rowIndex = computed(() => new Map(rows.value.map((row, at) => [row.key, at])))

const labelOf = (node: TreeNodeData) => node.label ?? String(node.key)
const rowId = (key: TreeKey) => `${id}-${String(key).replace(/[^\w-]/g, '_')}`

/* checking */

// What each node shows: checked, partly checked (some of its children), or neither.
const checkState = computed(() => {
  const set = new Set(checkedModel.value ?? [])
  const checked = new Set<TreeKey>()
  const half = new Set<TreeKey>()
  if (props.checkStrictly) return { checked: set, half }
  // A checked branch checks everything under it; a branch is checked once
  // every child is.
  const walk = (node: TreeNodeData, inherited: boolean): 'all' | 'some' | 'none' => {
    const self = inherited || set.has(node.key)
    const children = childrenOf(node)
    if (!children?.length) {
      if (self) checked.add(node.key)
      return self ? 'all' : 'none'
    }
    const states = children.map((child) => walk(child, self))
    if (states.every((state) => state === 'all')) {
      checked.add(node.key)
      return 'all'
    }
    if (states.some((state) => state !== 'none')) {
      half.add(node.key)
      return 'some'
    }
    return 'none'
  }
  for (const node of props.data) walk(node, false)
  // Keys of nodes not in the tree (yet) are kept as given.
  for (const key of set) if (!index.value.has(key)) checked.add(key)
  return { checked, half }
})

const isChecked = (key: TreeKey) => checkState.value.checked.has(key)
const isHalf = (key: TreeKey) => checkState.value.half.has(key)

function setChecked(node: TreeNodeData, value: boolean) {
  if (node.disabled) return
  const next = new Set(checkState.value.checked)
  if (props.checkStrictly) {
    if (value) next.add(node.key)
    else next.delete(node.key)
  } else {
    // Down: the node and everything under it, except disabled nodes,
    // which keep their own state.
    const walk = (current: TreeNodeData) => {
      if (current !== node && current.disabled) return
      if (value) next.add(current.key)
      else next.delete(current.key)
      for (const child of childrenOf(current) ?? []) walk(child)
    }
    walk(node)
    // Up: recomputed from the children.
    for (const key of ancestors(node.key)) {
      const children = childrenOf(index.value.get(key)!.node) ?? []
      if (children.every((child) => next.has(child.key))) next.add(key)
      else next.delete(key)
    }
  }
  const order = [...index.value.keys()]
  const keys = order.filter((key) => next.has(key))
  for (const key of next) if (!index.value.has(key)) keys.push(key)
  checkedModel.value = keys
  emit('check', node, value)
}

/* expanding */

async function setExpanded(node: TreeNodeData, value: boolean) {
  if (isLeaf(node) || isExpanded(node) === value) return
  const current = expandedModel.value ?? []
  expandedModel.value = value ? [...current, node.key] : current.filter((key) => key !== node.key)
  emit('expand', node, value)
  if (value && props.load && !childrenOf(node) && !loading.has(node.key)) {
    loading.add(node.key)
    try {
      loaded.set(node.key, await props.load(node))
    } catch (error) {
      expandedModel.value = (expandedModel.value ?? []).filter((key) => key !== node.key)
      emit('loadError', node, error)
    } finally {
      loading.delete(node.key)
    }
  }
}

function toggle(node: TreeNodeData) {
  void setExpanded(node, !isExpanded(node))
}

function select(node: TreeNodeData) {
  if (!props.selectable || node.disabled) return
  if (selectedModel.value !== node.key) selectedModel.value = node.key
  emit('select', node)
}

/* focus: it stays on the tree, which points at the active row */

const treeRef = useTemplateRef<HTMLElement>('tree')
const listRef = useTemplateRef<VirtualListExpose>('list')
const activeKey = ref<TreeKey | null>(null)
const active = computed(() =>
  activeKey.value !== null && rowIndex.value.has(activeKey.value) ? activeKey.value : null,
)

function activate(key: TreeKey | null | undefined) {
  if (key === null || key === undefined || !rowIndex.value.has(key)) return
  activeKey.value = key
  void reveal(key)
}

async function reveal(key: TreeKey) {
  await nextTick()
  const at = rowIndex.value.get(key)
  if (at === undefined) return
  if (props.height !== undefined) listRef.value?.scrollToIndex(at)
  else
    treeRef.value?.querySelector(`#${CSS.escape(rowId(key))}`)?.scrollIntoView?.({
      block: 'nearest',
    })
}

function onFocus() {
  if (active.value !== null) return
  const selected = selectedModel.value
  activeKey.value =
    selected !== null && selected !== undefined && rowIndex.value.has(selected)
      ? selected
      : (rows.value[0]?.key ?? null)
}

// Rows disappearing under the active one (a parent closing) move it up.
watch(rows, () => {
  if (activeKey.value === null || rowIndex.value.has(activeKey.value)) return
  const parent = ancestors(activeKey.value).find((key) => rowIndex.value.has(key))
  activeKey.value = parent ?? null
})

let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined

function onKeydown(event: KeyboardEvent) {
  const list = rows.value
  if (!list.length) return
  const at = active.value === null ? -1 : rowIndex.value.get(active.value)!
  const row = list[at]
  const go = (to: number) => activate(list[Math.max(0, Math.min(list.length - 1, to))]?.key)

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      return go(at + 1)
    case 'ArrowUp':
      event.preventDefault()
      return go(at < 0 ? 0 : at - 1)
    case 'Home':
      event.preventDefault()
      return go(0)
    case 'End':
      event.preventDefault()
      return go(list.length - 1)
    case 'ArrowRight':
      event.preventDefault()
      if (!row?.expandable) return
      if (!row.expanded) void setExpanded(row.node, true)
      else if (list[at + 1]?.level === row.level + 1) go(at + 1)
      return
    case 'ArrowLeft':
      event.preventDefault()
      if (!row) return
      if (row.expanded) void setExpanded(row.node, false)
      else activate(index.value.get(row.key)?.parent)
      return
    case 'Enter':
      event.preventDefault()
      if (!row) return
      if (props.selectable) select(row.node)
      else toggle(row.node)
      return
    case ' ':
      event.preventDefault()
      if (!row) return
      if (props.checkable) setChecked(row.node, !isChecked(row.key))
      else select(row.node)
      return
    case '*': {
      // Open every sibling of the active row.
      event.preventDefault()
      if (!row) return
      const parent = index.value.get(row.key)?.parent ?? null
      for (const sibling of list) {
        if (index.value.get(sibling.key)?.parent === parent) void setExpanded(sibling.node, true)
      }
      return
    }
  }

  // Typing jumps to the next row starting with it.
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
  clearTimeout(typedTimer)
  typed += event.key.toLowerCase()
  typedTimer = setTimeout(() => (typed = ''), 500)
  for (let offset = typed.length > 1 ? 0 : 1; offset <= list.length; offset++) {
    const candidate = list[(Math.max(at, 0) + offset) % list.length]!
    if (labelOf(candidate.node).toLowerCase().startsWith(typed)) return activate(candidate.key)
  }
}

function onRowClick(row: TreeRow) {
  activeKey.value = row.key
  if (row.node.disabled) return
  if (props.selectable) select(row.node)
  else if (props.checkable) setChecked(row.node, !isChecked(row.key))
  if (row.expandable && (props.expandOnClick || (!props.selectable && !props.checkable))) {
    toggle(row.node)
  }
}

/* the label, with the filter's match picked out */

function parts(node: TreeNodeData) {
  const label = labelOf(node)
  const text = query.value
  const at = text && !props.filterMethod ? label.toLowerCase().indexOf(text.toLowerCase()) : -1
  if (at < 0) return [{ text: label, match: false }]
  return [
    { text: label.slice(0, at), match: false },
    { text: label.slice(at, at + text.length), match: true },
    { text: label.slice(at + text.length), match: false },
  ].filter((part) => part.text)
}

/* exposed */

function expand(...keys: TreeKey[]) {
  const next = new Set(expandedModel.value ?? [])
  for (const key of keys) {
    for (const ancestor of ancestors(key)) next.add(ancestor)
    const entry = index.value.get(key)
    if (entry && !isLeaf(entry.node)) next.add(key)
  }
  expandedModel.value = [...next]
}
function collapse(...keys: TreeKey[]) {
  const drop = new Set(keys)
  expandedModel.value = (expandedModel.value ?? []).filter((key) => !drop.has(key))
}
function scrollTo(key: TreeKey) {
  const next = new Set(expandedModel.value ?? [])
  for (const ancestor of ancestors(key)) next.add(ancestor)
  expandedModel.value = [...next]
  void reveal(key)
}

defineExpose<TreeExpose>({
  focus: () => treeRef.value?.focus(),
  expand,
  collapse,
  expandAll: () => (expandedModel.value = branchKeys()),
  collapseAll: () => (expandedModel.value = []),
  scrollTo,
})

provide(treeContextKey, {
  ns,
  activeKey: active,
  selectedKey: computed(() => selectedModel.value ?? null),
  loading,
  props,
  rowId,
  parts,
  isChecked,
  isHalf,
  toggle,
  setChecked,
  onRowClick,
})

const rowHeight = computed(() => treeRowHeights[size.value])
const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('guides', props.guides),
  ns.is('selectable', props.selectable),
])
</script>

<template>
  <div
    ref="tree"
    role="tree"
    tabindex="0"
    :class="classes"
    :aria-label="ariaLabel"
    :aria-activedescendant="active !== null ? rowId(active) : undefined"
    :aria-multiselectable="checkable || undefined"
    @focus="onFocus"
    @keydown="onKeydown"
  >
    <DouVirtualList
      v-if="height !== undefined"
      ref="list"
      :class="ns.e('rows')"
      :items="rows"
      :item-size="rowHeight"
      item-key="key"
      :height="height"
      :overscan="6"
    >
      <template #default="{ item }">
        <TreeNode :row="item">
          <template v-if="slots.node" #default="scope"
            ><slot name="node" v-bind="scope"
          /></template>
        </TreeNode>
      </template>
    </DouVirtualList>
    <div v-else :class="ns.e('rows')">
      <TreeNode v-for="row in rows" :key="row.key" :row="row">
        <template v-if="slots.node" #default="scope"><slot name="node" v-bind="scope" /></template>
      </TreeNode>
    </div>
    <div v-if="!rows.length" :class="ns.e('empty')">
      <slot name="empty">{{ t('empty.title') }}</slot>
    </div>
  </div>
</template>
