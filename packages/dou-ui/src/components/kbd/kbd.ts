export type KbdSize = 'sm' | 'md'

export interface KbdProps {
  /** `sm` sits inside body text and menus, `md` stands on its own. */
  size?: KbdSize
}

export interface KbdSlots {
  /** The key, e.g. `⌘`, `K`, `Enter`. */
  default?: () => unknown
}
