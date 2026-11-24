import type { Component } from 'vue'
import type { SplitterLimit } from '../splitter/splitter'
import type { TabsSize, TabsValue } from '../tabs/tabs'
import type { DockGroup, DockNode, DockSide } from './layout'

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
  /**
   * Pin this tab to the start of its group's tab bar so it stays visible while
   * other tabs scroll. A pinned tab with an `icon` shows the icon alone with a
   * tooltip, and is not closable unless `closable: true` is set on the panel.
   */
  pinned?: boolean
  /**
   * Tabs sharing the same `mergeId` represent the same source. Moving or
   * dropping one into another group (or from outside) that already holds a tab
   * with the same `mergeId` removes the moved tab and activates that existing
   * tab instead.
   */
  mergeId?: TabsValue
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
  /**
   * The group last used, bound with `v-model:active-group`: the one a
   * pointer pressed in or the focus moved into last, or where a tab was
   * dropped or split off to. `undefined` once that group is gone.
   */
  activeGroup?: string
  /** Makes the id of a group split off. Defaults to `group-1`, `group-2`… */
  createId?: (layout: DockNode) => string
  /**
   * Runs before a tab move or center drop commits to the layout. Return `false`
   * to cancel the move, `{ mergeInto }` to merge into an existing tab in the
   * target group and activate it, or `{ mergeInto: null }` to skip automatic
   * `mergeId` merging and move normally.
   */
  beforeMove?: (context: DockBeforeMoveContext) => DockBeforeMoveResult
}

/** What `startDrop` drags in from outside the dock. */
export interface DockDropItem {
  /** The tab it opens, or moves when the layout has it already. Give it an entry in `panels`. */
  value: TabsValue
  /** The text of the tab that follows the pointer. Defaults to the label in `panels`. */
  label?: string
}

/** Where a tab is: the id of its group and its index there. */
export interface DockLocation {
  group: string
  index: number
}

/** Passed to `beforeMove` before a move or center drop commits. */
export interface DockBeforeMoveContext {
  value: TabsValue
  /** Where it was; `null` when it was dragged in from outside. */
  from: DockLocation | null
  /** Where it is about to land if moved normally. */
  to: DockLocation
  /** The target group before the move is applied. */
  targetGroup: DockGroup
  /**
   * The existing tab in `targetGroup` matched by `mergeId`, if any.
   */
  mergeInto?: TabsValue
}

export type DockBeforeMoveResult =
  | boolean
  | void
  | {
      /**
       * Existing tab in the target group to merge into and activate, or `null`
       * to skip an automatic `mergeId` merge and move the tab normally.
       */
      mergeInto: TabsValue | null
    }

export interface DockMoveEvent {
  value: TabsValue
  /** Where it was; `null` when it was dragged in from outside and opens here. */
  from: DockLocation | null
  /** Where it ends up, its index counted once the move is done. */
  to: DockLocation
  /**
   * When the moved tab merged into an existing tab in the target group instead
   * of being inserted, the value of that existing tab (now active).
   */
  mergedInto?: TabsValue
}

export interface DockSplitEvent {
  value: TabsValue
  /** Where it was; `null` when it was dragged in from outside and opens here. */
  from: DockLocation | null
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
  'update:activeGroup': [group: string | undefined]
}

export interface DockSlots {
  /** The content of a tab. */
  default?: (props: { value: TabsValue }) => unknown
  /** Replaces the text of a tab. */
  label?: (props: { value: TabsValue; selected: boolean }) => unknown
  /**
   * At the end of each group's tab row, as `DouTabs`' `extra`: e.g. actions
   * for that group. `active` is its selected tab, `undefined` when it has none.
   */
  extra?: (props: { group: DockGroup; active: TabsValue | undefined }) => unknown
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
  /**
   * Call in the `pointerdown` of an element outside the dock to drag it in
   * as a tab: dropped on a tab row, the middle or an edge of a group, it
   * opens there, as a dragged tab would. A value open already moves from
   * its group. Does nothing while `draggable` is off, or for a panel that
   * is disabled or not draggable.
   */
  startDrop: (event: PointerEvent, item: DockDropItem) => void
}
