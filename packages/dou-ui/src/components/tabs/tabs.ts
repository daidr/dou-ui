import type { InjectionKey, Ref } from 'vue'
import type { Size } from '../../utils/types'

export type TabsValue = string | number
export type TabsSize = Size
export type TabsActivation = 'auto' | 'manual'

export interface TabsProps {
  /** The value of the selected panel, bound with `v-model`. Defaults to the first enabled panel. */
  modelValue?: TabsValue
  size?: TabsSize
  /**
   * `auto` selects a tab as soon as arrow keys move focus to it; `manual`
   * waits for `Enter` or `Space`, for panels that are slow to render.
   */
  activation?: TabsActivation
}

export interface TabsEmits {
  'update:modelValue': [value: TabsValue]
  /** The user picked another tab. */
  change: [value: TabsValue]
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
