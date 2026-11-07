import type { Component } from 'vue'
import type { SplitterLimit } from '../splitter/splitter'
import type { TabsSize, TabsValue } from '../tabs/tabs'
import type { DockNode, DockSide } from './layout'

export type { DockGroup, DockNode, DockSide, DockSplit } from './layout'

/** What a tab shows; the layout only holds its value. */
export interface DockPanel {
  value: TabsValue
  label?: string
  icon?: Component
  /** Show a close button, overriding the dock's `closable`. */
  closable?: boolean
  disabled?: boolean
  /** Whether the tab can be dragged; `false` keeps it in its place. Defaults to `true`. */
  draggable?: boolean
}

/** The smallest a group may get, by direction: `width` across a side-by-side split, `height` across a stacked one. */
export interface DockMinSize {
  width?: SplitterLimit
  height?: SplitterLimit
}

export interface DockProps {
  /**
   * The layout, bound with `v-model`: splits of two parts and groups of
   * tabs. It holds ids alone, so it can be saved as JSON and restored.
   */
  modelValue: DockNode
  /** The label, icon and options of each tab, by value. */
  panels?: DockPanel[]
  size?: TabsSize
  /** Give every tab a close button that emits `remove`. A panel's own `closable` wins. */
  closable?: boolean
  /** Put a button after the tabs of each group that emits `add`. */
  addable?: boolean
  /**
   * Let tabs be dragged within and between the groups, and split off at
   * their edges. Defaults to `true`; a panel's own `draggable` wins.
   */
  draggable?: boolean
  /**
   * The smallest each side of a split may get, as `DouSplitter`'s `min`
   * and `minEnd`: numbers in percent, `'120px'` in px. An object gives
   * `width` and `height` apart; a direction left out takes `'120px'`.
   * The edge of a group too small to hold two of these splits nothing off.
   */
  min?: SplitterLimit | DockMinSize
  /** Makes the id of a group split off. Defaults to `group-1`, `group-2`… */
  createId?: (layout: DockNode) => string
}

/** Where a tab is: the id of its group and its index there. */
export interface DockLocation {
  group: string
  index: number
}

export interface DockMoveEvent {
  value: TabsValue
  from: DockLocation
  /** Where it ends up, its index counted once the move is done. */
  to: DockLocation
}

export interface DockSplitEvent {
  value: TabsValue
  from: DockLocation
  /** The group it was dropped on the edge of. */
  target: string
  side: DockSide
  /** The id of the new group, which holds the tab alone. */
  group: string
}

export interface DockEmits {
  'update:modelValue': [value: DockNode]
  /** A tab was dragged to another place in a group, or into another group. */
  move: [event: DockMoveEvent]
  /** A tab was dropped on the edge of a group and split off into a new group. */
  split: [event: DockSplitEvent]
  /**
   * The close button of a tab was pressed, or `Delete`. Remove it, e.g.
   * with `removeDockTab`. The same as `DouTabs`' `remove`, with the group.
   */
  remove: [value: TabsValue, group: string]
  /** The add button of a group was pressed. The same as `DouTabs`' `add`, with the group. */
  add: [group: string]
}

export interface DockSlots {
  /** The content of a tab. */
  default?: (props: { value: TabsValue }) => unknown
  /** Replaces the text of a tab. */
  label?: (props: { value: TabsValue; selected: boolean }) => unknown
  /** Shown when there is no tab left. */
  empty?: () => unknown
}

export interface DockExpose {
  /**
   * Whether a group has room for two `min`s in the direction of `side`:
   * when not, dropping a tab on that edge does not split it. Reactive,
   * so it can be read while rendering.
   */
  canSplit: (groupId: string, side: DockSide) => boolean
}
