import type { ComponentPublicInstance } from 'vue'
import type { VirtualListAlign, VirtualListKey } from '../virtual-list/virtual-list'

/**
 * A message to scroll to: its key with `items`; otherwise its element, or
 * the component that renders it (a `ref` on DouChatMessage).
 */
export type ChatListTarget = VirtualListKey | HTMLElement | ComponentPublicInstance

/** @internal Whether the target is an element or a component, not a key. */
export const isTarget = (target: ChatListTarget): target is HTMLElement | ComponentPublicInstance =>
  typeof target === 'object' && target !== null

/** @internal The element of a target: a component gives its root element. */
export function elementOf(target: HTMLElement | ComponentPublicInstance): HTMLElement | null {
  const el = '$el' in target ? (target.$el as unknown) : target
  return el instanceof HTMLElement ? el : null
}

export interface ChatListProps<T = any> {
  /**
   * Follow new content: while the list is scrolled to the bottom, it stays
   * there as messages arrive and text streams in. Scrolling up pauses
   * following until the bottom is reached again.
   */
  autoScroll?: boolean
  /** How close to the bottom, in px, still counts as at the bottom. */
  threshold?: number
  /** Show a button that scrolls back down while the list is away from the bottom. */
  showScrollButton?: boolean
  /**
   * The messages as data, drawn one by one with the `item` slot. Only the
   * messages in or near view are in the page, so long conversations stay
   * light; each is measured once rendered.
   */
  items?: T[]
  /** With `items`, a property of each message, or a function, that gives it a unique key. */
  itemKey?: string | ((item: T, index: number) => VirtualListKey)
  /** With `items`, the height in px to assume for a message not rendered yet. */
  estimateSize?: number
}

export interface ChatListEmits {
  /** Whether the list is at the bottom changed. */
  atBottomChange: [atBottom: boolean]
  /** Scrolled to the very top, e.g. to load earlier messages. */
  topReached: []
}

export interface ChatListSlots<T = any> {
  /** The messages, usually `DouChatBubble`s. */
  default?: () => unknown
  /** With `items`, one message. */
  item?: (props: { item: T; index: number }) => unknown
  /** Replaces the scroll-to-bottom button. */
  button?: (props: { scrollToBottom: () => void }) => unknown
}

export interface ChatListExpose {
  /** The scrolling element. */
  viewport: HTMLElement | null
  /** Scroll to the end and follow new content again. */
  scrollToBottom: (behavior?: ScrollBehavior) => void
  /**
   * Jump to one message, e.g. one found by a search, and stop following
   * new content. With `items` give its key (as `itemKey` makes it, or its
   * index without one); otherwise its element or its DouChatMessage. Pair
   * it with the message's `highlighted` to show which one it is. A target
   * not in the list is ignored. `align` defaults to `center`.
   */
  scrollToMessage: (target: ChatListTarget | null | undefined, align?: VirtualListAlign) => void
  /** Whether the list is at the bottom now. */
  readonly atBottom: boolean
}
