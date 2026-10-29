import type { InjectionKey, Ref } from 'vue'
import type { DropdownValue } from '../dropdown/dropdown'

export type MenubarSize = 'sm' | 'md'

export interface MenubarProps {
  size?: MenubarSize
  /** Go from the last menu back to the first with the arrow keys, and the other way. */
  loop?: boolean
}

export interface MenubarEmits {
  /** An item was chosen in one of the menus. */
  select: [value: DropdownValue | undefined, menu: string]
}

export interface MenubarSlots {
  /** `DouMenubarMenu`s. */
  default?: () => unknown
}

export interface MenubarMenuProps {
  /** The text of the menu's button; the `label` slot replaces it. */
  label?: string
  /** Names the menu in the `select` event. Defaults to `label`. */
  name?: string
  disabled?: boolean
}

export interface MenubarMenuSlots {
  /** The items: `DouDropdownItem`, `DouDropdownSub` and `DouDropdownRadioGroup`. */
  default?: () => unknown
  /** The menu's button text. */
  label?: () => unknown
}

export interface MenubarContext {
  /** The id of the open menu, or `null`. */
  active: Ref<string | null>
  /** Open the menu `step` places away from `from`, with its first item focused. */
  move: (from: string, step: 1 | -1) => void
  select: (value: DropdownValue | undefined, menu: string) => void
}

export const menubarKey: InjectionKey<MenubarContext> = Symbol('DouMenubar')
