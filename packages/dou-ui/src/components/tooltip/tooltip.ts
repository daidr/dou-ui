import type { Placement } from '../../composables/use-floating'

export type TooltipPlacement = Placement

export interface TooltipProps {
  /** Whether the tooltip shows, bound with `v-model:open`. Usually left to hover and focus. */
  open?: boolean
  /** The text. Use the `content` slot for anything richer. */
  content?: string
  /**
   * A hotkey in `useHotkey` syntax, e.g. `mod+z`, shown as keys after the
   * text and given to the trigger as its `aria-keyshortcuts`.
   */
  shortcut?: string
  /** The preferred side, flipped when there is no room. */
  placement?: TooltipPlacement
  disabled?: boolean
  /** Delay before showing on hover, in ms. */
  showDelay?: number
  /** Delay before hiding once the pointer leaves, in ms. */
  hideDelay?: number
  /** The gap to the trigger, in px. */
  offset?: number
  /** Follow the pointer while it moves over the trigger, instead of sitting by the trigger. */
  followCursor?: boolean
  /**
   * Let the pointer move onto the tooltip without closing it, e.g. to select
   * its text. Turn off so it closes as soon as the pointer leaves the
   * trigger. Always off with `followCursor`.
   */
  interactive?: boolean
  /** Where to render the tooltip; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface TooltipSlots {
  /** The trigger. Its first element receives the listeners and `aria-describedby`. */
  default?: () => unknown
  content?: () => unknown
}
