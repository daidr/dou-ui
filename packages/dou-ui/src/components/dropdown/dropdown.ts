import type { InjectionKey } from 'vue'
import type { Placement } from '../../composables/use-floating'

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

export interface DropdownContext {
  select: (value: DropdownValue | undefined) => void
}

export const dropdownKey: InjectionKey<DropdownContext> = Symbol('DouDropdown')
