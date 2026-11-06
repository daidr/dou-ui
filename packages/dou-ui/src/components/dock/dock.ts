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
  /** The smallest a part may get when resizing, numbers in percent. */
  minSize?: SplitterLimit
  /** Makes the id of a group split off. Defaults to `group-1`, `group-2`… */
  createId?: (layout: DockNode) => string
}

export interface DockMoveEvent {
  value: TabsValue
  /** The group it came from. */
  from: string
  /** The group it went to. */
  to: string
  /** Its index there. */
  index: number
}

export interface DockSplitEvent {
  value: TabsValue
  /** The group it came from. */
  from: string
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
  /** The close button of a tab was pressed, or `Delete`. Remove it, e.g. with `removeDockTab`. */
  remove: [value: TabsValue, group: string]
  /** The add button of a group was pressed. */
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
