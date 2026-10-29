export interface ChatListProps {
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
}

export interface ChatListEmits {
  /** Whether the list is at the bottom changed. */
  'update:atBottom': [atBottom: boolean]
  /** Scrolled to the very top, e.g. to load earlier messages. */
  topReached: []
}

export interface ChatListSlots {
  /** The messages, usually `DouChatBubble`s. */
  default?: () => unknown
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
