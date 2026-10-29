export interface ScrollbarProps {
  /** A fixed height. Numbers are px. */
  height?: number | string
  /** Grow with the content up to this height, then scroll. Numbers are px. */
  maxHeight?: number | string
  /** Keep the bars visible instead of showing them on hover and while scrolling. */
  always?: boolean
}

export interface ScrollbarEmits {
  scroll: [position: { scrollTop: number; scrollLeft: number }]
}

export interface ScrollbarSlots {
  default?: () => unknown
}

export interface ScrollbarExpose {
  /** The element that scrolls. */
  wrap: HTMLElement | null
  scrollTo: (options: ScrollToOptions) => void
  /** Measure again, e.g. after the content changed size in a way that is not observed. */
  update: () => void
}
