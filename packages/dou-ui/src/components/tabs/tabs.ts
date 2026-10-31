import type { InjectionKey, Ref } from 'vue'
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
  /** Give every tab a close button that emits `remove`. A panel's own `closable` wins. */
  closable?: boolean
  /** Put a button after the tabs that emits `add`. */
  addable?: boolean
  /**
   * Called before another tab is selected. Return `false`, or a promise of
   * `false`, to stay on the current one, e.g. while a form has unsaved changes.
   */
  beforeLeave?: (next: TabsValue, current: TabsValue | undefined) => boolean | Promise<boolean>
}

export interface TabsEmits {
  'update:modelValue': [value: TabsValue]
  /** The user picked another tab. */
  change: [value: TabsValue]
  /** The close button of a tab was pressed, or `Delete` on a closable tab. Remove its panel. */
  remove: [value: TabsValue]
  /** The add button was pressed. */
  add: []
}

export interface TabsSlots {
  /** The panels, `DouTabPanel`s. */
  default?: () => unknown
  /** Placed at the end of the tab list, e.g. an action button. */
  extra?: () => unknown
}

export interface TabPanelProps {
  value: TabsValue
  /** The text of the tab. */
  label?: string
  disabled?: boolean
  /** Show a close button on this tab, overriding the tabs' `closable`. */
  closable?: boolean
  /**
   * Render the content before the panel is first shown, instead of on
   * first show. For content that must exist while hidden, e.g. form
   * fields that are checked on submit.
   */
  eager?: boolean
}

export interface TabPanelSlots {
  default?: () => unknown
  /** Replaces the text of the tab, e.g. to add an icon or a count. */
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
