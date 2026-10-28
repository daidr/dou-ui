import type { InjectionKey, Ref } from 'vue'

export type CollapseValue = string | number

export interface CollapseProps {
  /** The values of the open items, bound with `v-model`. */
  modelValue?: CollapseValue[]
  /** Keep at most one item open; opening one closes the others. */
  accordion?: boolean
  /** Draw a frame around the items instead of hairlines between them. */
  bordered?: boolean
  /** The heading level of the item headers, for the page outline. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
}

export interface CollapseEmits {
  'update:modelValue': [value: CollapseValue[]]
  /** An item was opened or closed by the user. */
  change: [value: CollapseValue, open: boolean]
}

export interface CollapseSlots {
  /** The items, `DouCollapseItem`s. */
  default?: () => unknown
}

export interface CollapseItemProps {
  value: CollapseValue
  /** The text of the header. */
  title?: string
  disabled?: boolean
}

export interface CollapseItemSlots {
  default?: () => unknown
  /** Replaces the text of the header. */
  title?: (props: { open: boolean }) => unknown
  /** Placed at the end of the header, outside the toggle button. */
  extra?: () => unknown
}

export interface CollapseContext {
  open: Readonly<Ref<CollapseValue[]>>
  headingLevel: Readonly<Ref<number>>
  toggle: (value: CollapseValue) => void
}

export const collapseKey: InjectionKey<CollapseContext> = Symbol('DouCollapse')
