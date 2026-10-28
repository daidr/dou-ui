import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'
import type { TreeKey, TreeNodeData } from '../tree/tree'

export type TreeSelectValue = TreeKey | TreeKey[] | null

export interface TreeSelectProps {
  /** The chosen key, or the checked keys with `multiple`. Bound with `v-model`. */
  modelValue?: TreeSelectValue
  data: TreeNodeData[]
  /** Check any number of nodes; they show as tags. */
  multiple?: boolean
  /**
   * Check each node on its own. By default checking a branch checks
   * everything under it, and the field shows the branch instead of its children.
   */
  checkStrictly?: boolean
  /** Only leaves can be chosen; pressing a branch opens or closes it. */
  leafOnly?: boolean
  /** Type in the field to narrow the tree down. */
  filterable?: boolean
  /** Open every branch the first time the list opens. */
  defaultExpandAll?: boolean
  /** Fetch the children of a node the first time it opens. */
  load?: (node: TreeNodeData) => Promise<TreeNodeData[]>
  /** Shown while nothing is chosen. Defaults to the locale's. */
  placeholder?: string
  size?: Size
  disabled?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Show a button that clears the choice. */
  clearable?: boolean
  /** Render only the rows in view, inside a list this tall. A number is in px. */
  height?: number | string
  /** Where the list opens, flipped when there is no room. */
  placement?: Placement
  /** Where to render the list; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
  /** Names a field that has no visible label. */
  ariaLabel?: string
}

export interface TreeSelectEmits {
  'update:modelValue': [value: TreeSelectValue]
  /** The user chose, checked or removed a node. */
  change: [value: TreeSelectValue]
  /** The clear button was pressed. */
  clear: []
}

export interface TreeSelectSlots {
  /** Content inside the field before the value, usually an icon. */
  prefix?: () => unknown
  /** The content of a row in the tree. */
  node?: (props: { node: TreeNodeData; selected: boolean; checked: boolean }) => unknown
  /** Shown when there are no nodes, or none match the search. */
  empty?: () => unknown
}

export interface TreeSelectExpose {
  focus: () => void
  blur: () => void
}
