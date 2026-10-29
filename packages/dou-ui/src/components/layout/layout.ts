import type { Breakpoint } from '@dou-ui/theme'
import type { InjectionKey, Ref, ShallowRef } from 'vue'
import type { Size } from '../../utils/types'

export interface LayoutSlots {
  /** Headers, asides, the main area and footers, or nested layouts. */
  default?: () => unknown
}

export interface LayoutHeaderProps {
  /** Numbers are px. */
  height?: number | string
  /** Stay at the top of the scrolling page. */
  sticky?: boolean
  /** A hairline under the header. */
  bordered?: boolean
}

export interface LayoutAsideProps {
  /** The width when expanded. Numbers are px. */
  width?: number | string
  /** The width when collapsed, e.g. a column of menu icons. Numbers are px. */
  collapsedWidth?: number | string
  /** Whether the aside is collapsed, bound with `v-model:collapsed`. */
  collapsed?: boolean
  /** Show a button at the bottom that collapses and expands the aside. */
  collapsible?: boolean
  /** Stay in view while the page scrolls, below a sticky header. */
  sticky?: boolean
  /** A hairline on the side facing the main area. */
  bordered?: boolean
  /**
   * Below this viewport width the aside leaves the page and opens as a
   * drawer instead, from a `DouLayoutAsideTrigger` or `v-model:open`. A
   * breakpoint name such as `'md'`, or a width in px.
   */
  breakpoint?: Breakpoint | number
  /** The edge the drawer slides in from on narrow screens. */
  side?: 'left' | 'right'
  /** Whether the drawer is open on narrow screens, bound with `v-model:open`. */
  open?: boolean
}

export interface LayoutAsideEmits {
  'update:collapsed': [collapsed: boolean]
  'update:open': [open: boolean]
}

export interface LayoutAsideSlotProps {
  collapsed: boolean
  /** Whether the aside is showing as a drawer, below `breakpoint`. */
  drawer: boolean
  /** Close the drawer, e.g. after a menu item is chosen. Does nothing outside drawer mode. */
  close: () => void
}

export interface LayoutAsideSlots {
  default?: (props: LayoutAsideSlotProps) => unknown
  /** Pinned under the content, above the collapse button, e.g. the account. */
  footer?: (props: LayoutAsideSlotProps) => unknown
}

export interface LayoutAsideTriggerProps {
  size?: Size
}

export interface LayoutSectionSlots {
  default?: () => unknown
}

export interface LayoutDrawer {
  open: Ref<boolean>
  id: string
}

export interface LayoutContext {
  /** How far a sticky aside sits from the top: the height of a sticky header above it. */
  stickyTop: Ref<string | undefined>
  /** The aside currently shown as a drawer, which a trigger opens. */
  drawer: ShallowRef<LayoutDrawer | undefined>
}

export const layoutKey: InjectionKey<LayoutContext> = Symbol('DouLayout')
