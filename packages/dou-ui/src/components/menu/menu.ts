import type { Component, InjectionKey, Ref } from 'vue'

export type MenuKey = string | number
export type MenuMode = 'vertical' | 'horizontal'

export interface MenuItemOption {
  key: MenuKey
  label: string
  /** An icon component, shown before the label and alone when the menu is collapsed. */
  icon?: Component
  disabled?: boolean
  /** Render the item as a link. Without it the item is a button. */
  href?: string
  /** Turns the item into a submenu. */
  children?: MenuOption[]
}

/** A labelled section of items. */
export interface MenuGroupOption {
  type: 'group'
  label: string
  children: MenuOption[]
}

export interface MenuDividerOption {
  type: 'divider'
}

export type MenuOption = MenuItemOption | MenuGroupOption | MenuDividerOption

export interface MenuProps {
  items?: MenuOption[]
  /** The key of the current item, bound with `v-model`. */
  modelValue?: MenuKey
  /**
   * The keys of the open submenus, bound with `v-model:expanded`. Left
   * unbound, the submenus around the current item start open.
   */
  expanded?: MenuKey[]
  mode?: MenuMode
  /** Vertical only: shrink to a column of icons; submenus open to the side. */
  collapsed?: boolean
  /** Keep at most one submenu open on each level. */
  accordion?: boolean
}

export interface MenuEmits {
  'update:modelValue': [key: MenuKey]
  'update:expanded': [keys: MenuKey[]]
  /** An item without children was chosen. */
  select: [key: MenuKey, item: MenuItemOption]
  /**
   * An item was right-clicked, long-pressed, or got the menu key, including
   * submenus, disabled items and the items of popups. Wrap the menu in
   * `DouContextMenu` and note the item here to act on it in `select`.
   */
  itemContextmenu: [item: MenuItemOption, event: MouseEvent]
}

export interface MenuSlots {
  /** Replaces the label of each item, e.g. to add a badge. */
  label?: (props: { item: MenuItemOption; selected: boolean }) => unknown
}

export interface MenuContext {
  selected: Readonly<Ref<MenuKey | undefined>>
  isExpanded: (key: MenuKey) => boolean
  /** Whether the submenu holds the current item somewhere below it. */
  holdsSelected: (item: MenuItemOption) => boolean
  toggle: (item: MenuItemOption) => void
  /** Make the item current. Items in a popup follow their `href` from script. */
  choose: (item: MenuItemOption, fromPopup?: boolean) => void
  contextmenu: (item: MenuItemOption, event: MouseEvent) => void
  labelSlot: () => MenuSlots['label']
  subId: (key: MenuKey) => string
}

export const menuKey: InjectionKey<MenuContext> = Symbol('DouMenu')

export const isGroup = (option: MenuOption): option is MenuGroupOption =>
  'type' in option && option.type === 'group'
export const isDivider = (option: MenuOption): option is MenuDividerOption =>
  'type' in option && option.type === 'divider'
export const isItem = (option: MenuOption): option is MenuItemOption => !('type' in option)

/** The chain of submenu keys from the top down to `key`, or `undefined` when it is not there. */
export function pathTo(options: MenuOption[], key: MenuKey): MenuKey[] | undefined {
  for (const option of options) {
    if (isDivider(option)) continue
    if (isGroup(option)) {
      const found = pathTo(option.children, key)
      if (found) return found
      continue
    }
    if (option.key === key) return []
    if (option.children) {
      const found = pathTo(option.children, key)
      if (found) return [option.key, ...found]
    }
  }
  return undefined
}

export type FlatEntry =
  { kind: 'item'; item: MenuItemOption } | { kind: 'label'; label: string } | { kind: 'divider' }

/**
 * Lay a submenu out as one list for a popup: groups and deeper submenus
 * become labelled sections.
 */
export function flatten(options: MenuOption[]): FlatEntry[] {
  const entries: FlatEntry[] = []
  for (const option of options) {
    if (isDivider(option)) entries.push({ kind: 'divider' })
    else if (isGroup(option)) {
      entries.push({ kind: 'label', label: option.label })
      entries.push(...flatten(option.children))
    } else if (option.children?.length) {
      entries.push({ kind: 'label', label: option.label })
      entries.push(...flatten(option.children))
    } else entries.push({ kind: 'item', item: option })
  }
  return entries
}
