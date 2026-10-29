import { labelOf, type BlockOption } from './core/extension'
import type { BlockProps } from './core/model'
import type { EditorMessages } from './locale'

/** Options whose label, key or keywords match the query (case-insensitive). */
export function filterOptions(options: BlockOption[], query: string, messages: EditorMessages) {
  const needle = query.trim().toLowerCase()
  if (!needle) return options
  return options.filter((option) => {
    const label = labelOf(option.label, messages).toLowerCase()
    return (
      label.includes(needle) ||
      option.key.toLowerCase().includes(needle) ||
      (option.keywords ?? []).some((word) => word.startsWith(needle))
    )
  })
}

/** Whether an option describes the block as it is now: same type, same option props. */
export function isCurrent(option: BlockOption, type: string, props: BlockProps): boolean {
  if (option.type !== type) return false
  return Object.entries(option.props ?? {}).every(([name, value]) => props[name] === value)
}

export type { BlockOption }
