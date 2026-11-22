import type { Placement } from '../../composables/use-floating'
import type { PopupTrigger } from '../../composables/use-popup'

export type PopoverPlacement = Placement
export type PopoverTrigger = Exclude<PopupTrigger, 'focus'>

export interface PopoverProps {
  /** Whether the popover is open, bound with `v-model:open`. */
  open?: boolean
  /** A heading at the top of the panel; also names it for screen readers. */
  title?: string
  /** The body text. Use the default `content` slot for anything richer. */
  content?: string
  /** The preferred side, flipped when there is no room. */
  placement?: PopoverPlacement
  /** What opens the popover. `manual` leaves it entirely to `v-model:open`. */
  trigger?: PopoverTrigger
  disabled?: boolean
  /** The width of the panel; a number is in px. */
  width?: string | number
  /** The maximum height of the panel; a number is in px. Still capped to the available viewport height. */
  maxHeight?: string | number
  /** Delay before opening on hover, in ms. */
  showDelay?: number
  /** Delay before closing once the pointer leaves, in ms. */
  hideDelay?: number
  /** The gap to the trigger, in px. */
  offset?: number
  /**
   * Whether a tap on touch or pen devices opens and closes a `hover` popover.
   * Turn off when the trigger has its own click action.
   */
  openOnTap?: boolean
  /** Where to render the panel; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface PopoverSlots {
  /** The trigger. Its first element receives the listeners and ARIA attributes. */
  default?: () => unknown
  title?: () => unknown
  content?: (props: { close: () => void }) => unknown
}

export interface PopoverExpose {
  open: () => void
  close: () => void
}
