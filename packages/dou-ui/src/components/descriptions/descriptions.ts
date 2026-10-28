import type { InjectionKey, Ref } from 'vue'

export type DescriptionsLayout = 'vertical' | 'horizontal'

export interface DescriptionsProps {
  /** Heading above the list. */
  title?: string
  /** How many items share a row. */
  columns?: number
  /** `vertical` puts each label above its value, `horizontal` beside it. */
  layout?: DescriptionsLayout
  /** Draw the list as a table: hairlines between cells and tinted labels. */
  bordered?: boolean
  /** Width of the labels in the horizontal layout, e.g. `96px`. A number is in px. */
  labelWidth?: string | number
}

export interface DescriptionsSlots {
  /** Replaces the title. */
  title?: () => unknown
  /** Placed at the end of the header, e.g. an edit button. */
  extra?: () => unknown
  /** The items, `DouDescriptionsItem`s. */
  default?: () => unknown
}

export interface DescriptionsItemProps {
  label?: string
  /** How many columns the item spans; `fill` takes a whole row of its own. */
  span?: number | 'fill'
}

export interface DescriptionsItemSlots {
  /** The value. */
  default?: () => unknown
  /** Replaces the label. */
  label?: () => unknown
}

export interface DescriptionsContext {
  columns: Readonly<Ref<number>>
}

export const descriptionsKey: InjectionKey<DescriptionsContext> = Symbol('DouDescriptions')
