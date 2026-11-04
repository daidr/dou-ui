import type { InjectionKey } from 'vue'
import type { Placement } from '../../composables/use-floating'
import type { Size, Tone } from '../../utils/types'
import type { ContextMenuEntry } from '../context-menu/context-menu'

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
  /**
   * The items as data, in place of the `menu` slot; a chosen item's `run`
   * is called. Ignored when the `menu` slot is given.
   */
  items?: ContextMenuEntry[]
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
  /**
   * Make the item a checkbox: it shows a check while `true` and toggles
   * on click. Bound with `v-model:checked`.
   */
  checked?: boolean
  /**
   * A keyboard shortcut to show after the label, e.g. `mod+s`, written as
   * in `useHotkey` and shown the way the platform writes it. It is only
   * shown: bind the key yourself.
   */
  shortcut?: string
  /**
   * A line under the label that says more about the item; the `description`
   * slot replaces it. Screen readers read it after the label, and typing
   * still jumps by the label.
   */
  description?: string
}

export interface DropdownItemEmits {
  click: [event: MouseEvent | KeyboardEvent]
  'update:checked': [checked: boolean]
}

export interface DropdownItemSlots {
  default?: () => unknown
  /** Before the label, usually an icon. */
  prefix?: () => unknown
  /** After the label, e.g. a shortcut. */
  suffix?: () => unknown
  /** The line under the label, in place of `description`. */
  description?: () => unknown
}

export interface DropdownGroupProps {
  /** The heading above the items; the `label` slot replaces it. */
  label?: string
  /** Draw a separator above the group. */
  divided?: boolean
}

export interface DropdownGroupSlots {
  /** The group's items. */
  default?: () => unknown
  /** The heading, in place of `label`. */
  label?: () => unknown
}

export interface DropdownRadioGroupProps extends DropdownGroupProps {
  /** The value of the chosen item, bound with `v-model`. */
  modelValue?: DropdownValue
}

export interface DropdownRadioGroupEmits {
  'update:modelValue': [value: DropdownValue]
}

export interface DropdownRadioGroupSlots {
  /** `DouDropdownItem`s with a `value`; the one matching `v-model` shows a dot. */
  default?: () => unknown
  /** The heading, in place of `label`. */
  label?: () => unknown
}

export interface DropdownRadioGroupContext {
  value: () => DropdownValue | undefined
  pick: (value: DropdownValue) => void
}

export const dropdownRadioGroupKey: InjectionKey<DropdownRadioGroupContext> =
  Symbol('DouDropdownRadioGroup')

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
  /** Left or right out of the menu, when something such as a menubar handles that. */
  move?: (direction: 1 | -1) => void
}

export const dropdownKey: InjectionKey<DropdownContext> = Symbol('DouDropdown')

/**
 * Provided by a component that owns dropdowns side by side, such as a
 * menubar: `ArrowLeft` and `ArrowRight` inside a menu go to it.
 */
export interface DropdownHost {
  move: (direction: 1 | -1) => void
}

export const dropdownHostKey: InjectionKey<DropdownHost> = Symbol('DouDropdownHost')
