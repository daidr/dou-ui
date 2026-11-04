import type {
  ContextMenuEntry,
  ContextMenuGroup,
  ContextMenuItem,
} from '../context-menu/context-menu'

export const isMenuGroup = (entry: ContextMenuEntry): entry is ContextMenuGroup =>
  'type' in entry && entry.type === 'group'

/** The item with `key`, in a group or not. */
export function findMenuItem(
  entries: ContextMenuEntry[] | undefined,
  key: unknown,
): ContextMenuItem | undefined {
  for (const entry of entries ?? []) {
    if (!isMenuGroup(entry)) {
      if (entry.key === key) return entry
    } else {
      const found = entry.children.find((item) => item.key === key)
      if (found) return found
    }
  }
  return undefined
}
