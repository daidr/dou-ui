import { RedoIcon, UndoIcon } from '@dou-ui/icons'
import { markRaw } from 'vue'
import { type CodeCommand, insertTab, redo, undo } from './core/commands'
import type { CodeMessages } from './locale'
import type { CodeKey } from './types'

const SYMBOLS = '(){}[]<>=;:,.\'"`/\\|&!?+-*_$#%'

/**
 * The keys of the bar that scroll: Tab, the symbols code is full of, then
 * undo and redo. Spread it to add keys: `[...defaultCodeKeys, { label: '=>', text: ' => ' }]`.
 */
export const defaultCodeKeys: readonly CodeKey[] = Object.freeze([
  { label: 'Tab', command: insertTab },
  ...[...SYMBOLS].map((ch) => ({ label: ch })),
  { label: 'Undo', icon: markRaw(UndoIcon), command: undo, repeat: true },
  { label: 'Redo', icon: markRaw(RedoIcon), command: redo, repeat: true },
])

/** Names read out for the built-in commands, in the bar's language. */
const NAMES = new Map<CodeCommand, keyof CodeMessages>([
  [insertTab, 'indent'],
  [undo, 'undo'],
  [redo, 'redo'],
])

/** What screen readers read for a key, when its label doesn't say it. */
export function keyName(key: CodeKey, messages: CodeMessages): string | undefined {
  if (key.ariaLabel) return key.ariaLabel
  const name = key.command && NAMES.get(key.command)
  if (name) return messages[name]
  return key.icon ? key.label : undefined
}
