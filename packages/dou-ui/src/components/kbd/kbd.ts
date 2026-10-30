export type KbdSize = 'sm' | 'md'

export interface KbdProps {
  /** `sm` sits inside body text and menus, `md` stands on its own. */
  size?: KbdSize
  /**
   * A hotkey in `useHotkey` syntax, e.g. `mod+k` or `g i`, shown with this
   * platform's key names: ⌘ K on Apple platforms, Ctrl K elsewhere.
   * Replaces the default slot.
   */
  keys?: string
}

export interface KbdSlots {
  /** The key, e.g. `⌘`, `K`, `Enter`. */
  default?: () => unknown
}
