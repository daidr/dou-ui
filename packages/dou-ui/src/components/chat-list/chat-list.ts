import type { VirtualListKey } from '../virtual-list/virtual-list'

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
  'update:atBottom': [atBottom: boolean]
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
  /** Whether the list is at the bottom now. */
  readonly atBottom: boolean
}
