export interface BreadcrumbItem {
  label: string
  /** Where the item links to. Without it the item is a button that emits `navigate`. */
  href?: string
  disabled?: boolean
}

export interface BreadcrumbProps {
  /** The path from the root to the current page, which is the last item. */
  items: BreadcrumbItem[]
  /** Text between items. Defaults to a slash. */
  separator?: string
  /**
   * Show at most this many items: the first, an ellipsis that expands the
   * path, and the last ones.
   */
  maxItems?: number
}

export interface BreadcrumbEmits {
  /** An item other than the current page was clicked. */
  navigate: [item: BreadcrumbItem, index: number, event: MouseEvent]
}

export interface BreadcrumbSlots {
  /** Replaces each item, e.g. with a router link. */
  item?: (props: { item: BreadcrumbItem; index: number; current: boolean }) => unknown
  /** Replaces the separator. */
  separator?: () => unknown
}
