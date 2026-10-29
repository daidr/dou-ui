import type { InjectionKey, Ref } from 'vue'

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
}

export interface LayoutAsideEmits {
  'update:collapsed': [collapsed: boolean]
}

export interface LayoutAsideSlots {
  default?: (props: { collapsed: boolean }) => unknown
  /** Pinned under the content, above the collapse button, e.g. the account. */
  footer?: (props: { collapsed: boolean }) => unknown
}

export interface LayoutSectionSlots {
  default?: () => unknown
}

export interface LayoutContext {
  /** How far a sticky aside sits from the top: the height of a sticky header above it. */
  stickyTop: Ref<string | undefined>
}

export const layoutKey: InjectionKey<LayoutContext> = Symbol('DouLayout')
