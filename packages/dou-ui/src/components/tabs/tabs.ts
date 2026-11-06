import type { Component, InjectionKey, Ref } from 'vue'
import type { Size } from '../../utils/types'

export type TabsValue = string | number
export type TabsSize = Size
export type TabsActivation = 'auto' | 'manual'
/** Where the tab list sits: above the panels, or beside them on the start or end side. */
export type TabsPlacement = 'top' | 'start' | 'end'

export interface TabsProps {
  /** The value of the selected panel, bound with `v-model`. Defaults to the first enabled panel. */
  modelValue?: TabsValue
  size?: TabsSize
  /**
   * `auto` selects a tab as soon as arrow keys move focus to it; `manual`
   * waits for `Enter` or `Space`, for panels that are slow to render.
   */
  activation?: TabsActivation
  placement?: TabsPlacement
  /**
   * A fixed height, numbers in px; `'100%'` fills the parent. The panels
   * fill it and scroll on their own, and so does a column of tabs that
   * does not fit. Left unset, the tabs grow with their content.
   */
  height?: number | string
  /**
   * Show each tab as its panel's `icon` alone. The label becomes the tab's
   * accessible name and shows in a tooltip on hover and focus.
   */
  iconOnly?: boolean
  /** Give every tab a close button that emits `remove`. A panel's own `closable` wins. */
  closable?: boolean
  /** Put a button after the tabs that emits `add`. */
  addable?: boolean
  /**
   * Called before another tab is selected. Return `false`, or a promise of
   * `false`, to stay on the current one, e.g. while a form has unsaved changes.
   */
  beforeLeave?: (next: TabsValue, current: TabsValue | undefined) => boolean | Promise<boolean>
  /**
   * Let the tabs be dragged to a new place, and take tabs dropped here.
   * `Alt` with the arrow keys moves the focused tab. The tabs only emit
   * `move`; put the panels in the new order yourself.
   */
  draggable?: boolean
  /** Tabs with the same group take each other's tabs. */
  group?: string
  /** Names these tabs in `move` events, to tell the tabs of a group apart. */
  name?: string
}

/** Where a tab is: the `name` of its tabs and its index there. */
export interface TabsLocation {
  name: string | undefined
  index: number
}

export interface TabsMoveEvent {
  value: TabsValue
  from: TabsLocation
  /** Where the tab ends up, its index counted once the move is done. */
  to: TabsLocation
}

export interface TabsEmits {
  'update:modelValue': [value: TabsValue]
  /** The user picked another tab. */
  change: [value: TabsValue]
  /** The close button of a tab was pressed, or `Delete` on a closable tab. Remove its panel. */
  remove: [value: TabsValue]
  /** The add button was pressed. */
  add: []
  /**
   * A tab was dragged, or moved with `Alt` and an arrow key. Sent by the
   * tabs it lands in, also when it comes from other tabs of the group.
   */
  move: [event: TabsMoveEvent]
}

export interface TabsSlots {
  /** The panels, `DouTabPanel`s. */
  default?: () => unknown
  /** Placed at the end of the tab list, e.g. an action button. */
  extra?: () => unknown
}

export interface TabPanelProps {
  value: TabsValue
  /** The text of the tab. With `iconOnly`, its accessible name and tooltip. */
  label?: string
  /** An icon component, shown before the label, and alone with the tabs' `iconOnly`. */
  icon?: Component
  disabled?: boolean
  /** Show a close button on this tab, overriding the tabs' `closable`. */
  closable?: boolean
  /** Whether this tab can be dragged, overriding the tabs' `draggable`. */
  draggable?: boolean
  /**
   * Render the content before the panel is first shown, instead of on
   * first show. For content that must exist while hidden, e.g. form
   * fields that are checked on submit.
   */
  eager?: boolean
}

export interface TabPanelSlots {
  default?: () => unknown
  /** Replaces the text of the tab, e.g. to add a count. Not shown with the tabs' `iconOnly`. */
  label?: (props: { selected: boolean }) => unknown
}

export interface TabPanelEntry {
  uid: number
  props: TabPanelProps
  slots: TabPanelSlots
  el: Ref<HTMLElement | null>
}

export interface TabsContext {
  selected: Readonly<Ref<TabsValue | undefined>>
  tabId: (value: TabsValue) => string
  panelId: (value: TabsValue) => string
  register: (entry: TabPanelEntry) => void
  unregister: (uid: number) => void
  reorder: () => void
}

export const tabsKey: InjectionKey<TabsContext> = Symbol('DouTabs')
