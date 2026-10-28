import type { Placement } from '../../composables/use-floating'

export type TooltipPlacement = Placement

export interface TooltipProps {
  /** Whether the tooltip shows, bound with `v-model:open`. Usually left to hover and focus. */
  open?: boolean
  /** The text. Use the `content` slot for anything richer. */
  content?: string
  /** The preferred side, flipped when there is no room. */
  placement?: TooltipPlacement
  disabled?: boolean
  /** Delay before showing on hover, in ms. */
  showDelay?: number
  /** Delay before hiding once the pointer leaves, in ms. */
  hideDelay?: number
  /** The gap to the trigger, in px. */
  offset?: number
  /** Where to render the tooltip; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface TooltipSlots {
  /** The trigger. Its first element receives the listeners and `aria-describedby`. */
  default?: () => unknown
  content?: () => unknown
}
