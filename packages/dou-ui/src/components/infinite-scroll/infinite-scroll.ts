import type { ScrollTarget } from '../../utils/scroll'

export interface InfiniteScrollProps {
  /**
   * Load the next page. While the returned promise is pending no other
   * load starts; when it rejects, the footer offers to try again.
   */
  load: () => unknown
  /** Nothing is left to load. The footer says so. */
  finished?: boolean
  /** Stop loading for now, e.g. while a filter changes. */
  disabled?: boolean
  /** Load when the end of the list is this close to the bottom of the scroll area, in px. */
  distance?: number
  /** The scroll area. Defaults to the nearest scroll container, or the window. */
  target?: ScrollTarget
  /** Check once on mount, so an empty list loads its first page. */
  immediate?: boolean
}

export interface InfiniteScrollSlots {
  /** The list. */
  default?: () => unknown
  /** Replaces the footer while loading. */
  loading?: () => unknown
  /** Replaces the footer once `finished`. */
  finished?: () => unknown
  /** Replaces the footer after a failed load. */
  error?: (props: { error: unknown; retry: () => void }) => unknown
}

export interface InfiniteScrollExpose {
  /** Load now if the end is in reach, e.g. after the list was replaced. */
  check: () => void
  /** Clear a failed load and try again. */
  retry: () => void
}

/** The value of `v-infinite-scroll`: the load function, or it with options. */
export type InfiniteScrollDirectiveValue =
  | (() => unknown)
  | {
      load: () => unknown
      disabled?: boolean
      /** In px. Defaults to 100. */
      distance?: number
      /** Defaults to `true`. */
      immediate?: boolean
    }
