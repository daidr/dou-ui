export type ChatBubblePlacement = 'start' | 'end' | 'center'
export type ChatBubbleVariant = 'filled' | 'outlined' | 'plain'

export interface ChatBubbleProps {
  /**
   * Which side the message sits on: `start` for the other party (e.g. the
   * assistant), `end` for the person using the app, `center` for a notice
   * from the system.
   */
  placement?: ChatBubblePlacement
  /** `filled` tints the bubble, `outlined` frames it, `plain` leaves the text bare. */
  variant?: ChatBubbleVariant
  /** The message as plain text. The default slot replaces it. */
  content?: string
  /** Who sent it, shown above the bubble. Also gives the avatar its initials. */
  name?: string
  /** When it was sent, shown next to the name. */
  time?: string
  /**
   * Show an avatar: an image URL, or `true` for the initials of `name`.
   * The `avatar` slot replaces it.
   */
  avatar?: string | boolean
  /** The reply is on its way: show three bouncing dots in place of the content. */
  loading?: boolean
}

export interface ChatBubbleSlots {
  /** The message. */
  default?: () => unknown
  /** Replaces the avatar, e.g. with a `DouAvatar` holding an icon. */
  avatar?: () => unknown
  /** Replaces the name and time above the bubble. */
  header?: () => unknown
  /** Under the bubble: actions such as copy and retry, or a note like "edited". */
  footer?: () => unknown
}
