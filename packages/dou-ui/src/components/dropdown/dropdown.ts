import type { InjectionKey } from 'vue'
import type { Placement } from '../../composables/use-floating'
import type { Size, Tone } from '../../utils/types'

export type DropdownPlacement = Placement
export type DropdownTrigger = 'click' | 'hover' | 'manual'
export type DropdownValue = string | number

export interface DropdownProps {
  /** Whether the menu is open, bound with `v-model:open`. */
  open?: boolean
  /** The preferred side, flipped when there is no room. */
  placement?: DropdownPlacement
  /** What opens the menu. Arrow keys on the trigger always do. */
  trigger?: DropdownTrigger
  disabled?: boolean
  /** Close the menu once an item is chosen. */
  hideOnSelect?: boolean
  /** Make the menu at least as wide as the trigger. */
  sameWidth?: boolean
  /** Delay before opening on hover, in ms. */
  showDelay?: number
  /** Delay before closing once the pointer leaves, in ms. */
  hideDelay?: number
  /** The gap to the trigger, in px. */
  offset?: number
  /** Where to render the menu; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface DropdownEmits {
  'update:open': [open: boolean]
  /** An item was chosen. */
  select: [value: DropdownValue | undefined]
}

export interface DropdownSlots {
  /** The trigger. Its first element receives the listeners and ARIA attributes. */
  default?: () => unknown
  /** The items, `DouDropdownItem`s. */
  menu?: () => unknown
}

export interface DropdownExpose {
  open: () => void
  close: () => void
}

export type DropdownItemTone = 'neutral' | 'danger'

export interface DropdownItemProps {
  /** Passed to the menu's `select` event. */
  value?: DropdownValue
  disabled?: boolean
  /** `danger` for destructive actions. */
  tone?: DropdownItemTone
  /** Draw a separator above the item. */
  divided?: boolean
}

export interface DropdownItemEmits {
  click: [event: MouseEvent | KeyboardEvent]
}

export interface DropdownItemSlots {
  default?: () => unknown
  /** Before the label, usually an icon. */
  prefix?: () => unknown
  /** After the label, e.g. a shortcut. */
  suffix?: () => unknown
}

export interface DropdownSubProps {
  /** The item's text; the `title` slot replaces it. */
  title?: string
  disabled?: boolean
  /** Draw a separator above the item. */
  divided?: boolean
  /** The preferred side of the submenu, flipped when there is no room. */
  placement?: DropdownPlacement
}

export interface DropdownSubSlots {
  /** The submenu's items: `DouDropdownItem`s and more `DouDropdownSub`s. */
  default?: () => unknown
  /** The item's text. */
  title?: () => unknown
  /** Before the text, usually an icon. */
  prefix?: () => unknown
}

export type DropdownButtonVariant = 'solid' | 'soft' | 'outline'

export interface DropdownButtonProps {
  variant?: DropdownButtonVariant
  tone?: Tone
  size?: Size
  /** Disable both halves. */
  disabled?: boolean
  /** Show a spinner on the main half and block it. */
  loading?: boolean
  /** The preferred side of the menu. */
  placement?: DropdownPlacement
  /** What opens the menu from the arrow half. */
  trigger?: Exclude<DropdownTrigger, 'manual'>
  /** Close the menu once an item is chosen. */
  hideOnSelect?: boolean
}

export interface DropdownButtonEmits {
  /** The main half was clicked. */
  click: [event: MouseEvent]
  /** An item of the menu was chosen. */
  select: [value: DropdownValue | undefined]
}

export interface DropdownButtonSlots {
  /** The main action's label. */
  default?: () => unknown
  /** Before the label, usually an icon. */
  leading?: () => unknown
  /** The items, `DouDropdownItem`s. */
  menu?: () => unknown
}

export interface DropdownContext {
  select: (value: DropdownValue | undefined) => void
  /** Whether the whole menu is open; submenus close with it. */
  opened: () => boolean
  /** The pointer entered or left a submenu, which keeps a hover menu open. */
  hold: () => void
  release: () => void
}

export const dropdownKey: InjectionKey<DropdownContext> = Symbol('DouDropdown')
