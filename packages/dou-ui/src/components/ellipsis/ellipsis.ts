import type { Placement } from '../../composables/use-floating'

export interface EllipsisProps {
  /** How many lines to show before cutting the text off. */
  lines?: number
  /** Add a button at the end that expands and collapses the text. */
  expandable?: boolean
  /** Expanded or not. Bound with `v-model:expanded`. */
  expanded?: boolean
  /** Show the full text in a tooltip while it is cut off. Not used with `expandable`. */
  tooltip?: boolean
  tooltipPlacement?: Placement
  /** The element to render. */
  as?: string
}

export interface EllipsisEmits {
  'update:expanded': [expanded: boolean]
}

export interface EllipsisSlots {
  /** The text. */
  default?: () => unknown
  /** Replaces the label of the expand button. */
  toggle?: (props: { expanded: boolean }) => unknown
  /** Replaces what the tooltip shows, which is the text by default. */
  tooltip?: () => unknown
}

export interface EllipsisExpose {
  /** Whether the text is cut off at the moment, or would be when collapsed. */
  readonly truncated: boolean
}
