import type { InjectionKey, Ref } from 'vue'
import type { useNamespace } from '../../utils/namespace'
import type { Size } from '../../utils/types'

export type TreeSize = Size
export type TreeKey = string | number

export interface TreeNodeData {
  /** Unique across the whole tree. */
  key: TreeKey
  /** Shown on the row. Defaults to the key. */
  label?: string
  children?: TreeNodeData[]
  disabled?: boolean
  /**
   * With `load`, a node without `children` is assumed to have some until
   * it is loaded; set `isLeaf` on the ones known to be empty.
   */
  isLeaf?: boolean
  [extra: string]: unknown
}

export interface TreeProps {
  data: TreeNodeData[]
  /** Keys of the open branches, bound with `v-model:expanded`. */
  expanded?: TreeKey[]
  /** The key of the selected node, bound with `v-model:selected`. */
  selected?: TreeKey | null
  /** Keys of the checked nodes, bound with `v-model:checked`. */
  checked?: TreeKey[]
  /** Clicking a row selects it. */
  selectable?: boolean
  /** Put a checkbox on every row. */
  checkable?: boolean
  /**
   * Check each node on its own. By default checking a branch checks
   * everything under it, and a branch is checked once all its children are.
   */
  checkStrictly?: boolean
  /** Open every branch on first render, unless `expanded` is bound. */
  defaultExpandAll?: boolean
  /** Clicking a branch row also opens or closes it. */
  expandOnClick?: boolean
  /** Fetch the children of a node the first time it opens. */
  load?: (node: TreeNodeData) => Promise<TreeNodeData[]>
  /** Show only the nodes matching this text, with their ancestors, opened to reveal them. */
  filter?: string
  /** Decides whether a node matches `filter`. Defaults to a case-insensitive search of the label. */
  filterMethod?: (query: string, node: TreeNodeData) => boolean
  /** Hairlines that join each child to its parent. */
  guides?: boolean
  /** Row density. */
  size?: TreeSize
  /** Render only the rows in view, inside a viewport of this height. A number is in px. */
  height?: number | string
  /** Names the tree for screen readers when it has no visible label. */
  ariaLabel?: string
}

export interface TreeEmits {
  'update:expanded': [keys: TreeKey[]]
  'update:selected': [key: TreeKey | null]
  'update:checked': [keys: TreeKey[]]
  /** The user selected a node. */
  select: [node: TreeNodeData]
  /** The user checked or unchecked a node. */
  check: [node: TreeNodeData, checked: boolean]
  /** The user opened or closed a branch. */
  expand: [node: TreeNodeData, expanded: boolean]
  /** `load` failed; the branch closes again. */
  loadError: [node: TreeNodeData, error: unknown]
}

export interface TreeNodeSlotProps {
  node: TreeNodeData
  level: number
  expanded: boolean
  selected: boolean
  checked: boolean
  indeterminate: boolean
}

export interface TreeSlots {
  /** The content of a row, after the arrow and the checkbox. */
  node?: (props: TreeNodeSlotProps) => unknown
  /** Shown when there are no nodes, or none match the filter. */
  empty?: () => unknown
}

export interface TreeExpose {
  focus: () => void
  /** Open the branches with these keys, and their ancestors. */
  expand: (...keys: TreeKey[]) => void
  collapse: (...keys: TreeKey[]) => void
  expandAll: () => void
  collapseAll: () => void
  /** Open the ancestors of a node and scroll it into view. */
  scrollTo: (key: TreeKey) => void
}

/** Row heights in px, shared with the stylesheet so a virtual tree can place rows. */
export const treeRowHeights: Record<TreeSize, number> = { sm: 24, md: 28, lg: 32 }

/** A visible row: a node with its place among its siblings. */
export interface TreeRow {
  node: TreeNodeData
  key: TreeKey
  level: number
  setSize: number
  position: number
  expandable: boolean
  expanded: boolean
}

export interface TreeContext {
  ns: ReturnType<typeof useNamespace>
  activeKey: Readonly<Ref<TreeKey | null>>
  selectedKey: Readonly<Ref<TreeKey | null>>
  loading: ReadonlySet<TreeKey>
  props: Readonly<TreeProps>
  rowId: (key: TreeKey) => string
  parts: (node: TreeNodeData) => { text: string; match: boolean }[]
  isChecked: (key: TreeKey) => boolean
  isHalf: (key: TreeKey) => boolean
  toggle: (node: TreeNodeData) => void
  setChecked: (node: TreeNodeData, value: boolean) => void
  onRowClick: (row: TreeRow) => void
}

export const treeContextKey: InjectionKey<TreeContext> = Symbol('DouTree')
