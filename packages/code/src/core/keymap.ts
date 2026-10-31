import * as cmd from './commands'
import type { CodeCommand } from './commands'

/**
 * A key and what it runs. Keys are written like `mod+shift+z`: `mod` is ⌘
 * on Apple devices and Ctrl elsewhere. `mac` replaces `key` on Apple
 * devices; leave `key` out for a binding that only exists there.
 */
export interface CodeKeyBinding {
  key?: string
  mac?: string
  run: CodeCommand
  /** Runs this with Shift held too, as the selecting version of a move. */
  shift?: CodeCommand
}

const ORDER = ['mod', 'ctrl', 'meta', 'alt', 'shift']

/** A key written as a binding, in one spelling for both platforms. */
export function normalizeKey(key: string, apple: boolean): string {
  const parts = key.toLowerCase().split('+')
  const name = parts.pop()!
  const mods = new Set(
    parts.map((part) => {
      if (part === 'cmd' || part === 'command') part = 'meta'
      if (part === 'control') part = 'ctrl'
      if (part === 'option') part = 'alt'
      // `mod` and the key it stands for on this platform are the same.
      if (apple ? part === 'meta' : part === 'ctrl') return 'mod'
      return part
    }),
  )
  return [...ORDER.filter((mod) => mods.has(mod)), name === 'space' ? ' ' : name].join('+')
}

/** A key press, spelled like `normalizeKey`. Letters and digits are read from the physical key, so ⌥ and layouts don't change them. */
export function eventKey(event: KeyboardEvent, apple: boolean): string {
  let name = event.key.toLowerCase()
  if (/^Key[A-Z]$/.test(event.code)) name = event.code.slice(3).toLowerCase()
  else if (/^Digit\d$/.test(event.code)) name = event.code.slice(5)
  const mods: string[] = []
  if (apple ? event.metaKey : event.ctrlKey) mods.push('mod')
  if (apple && event.ctrlKey) mods.push('ctrl')
  if (!apple && event.metaKey) mods.push('meta')
  if (event.altKey) mods.push('alt')
  if (event.shiftKey) mods.push('shift')
  return [...mods, name].join('+')
}

/** Looks up bindings by key; later bindings win over earlier ones. */
export function buildKeymap(bindings: readonly CodeKeyBinding[], apple: boolean) {
  const map = new Map<string, CodeCommand[]>()
  const add = (key: string, run: CodeCommand) => {
    const name = normalizeKey(key, apple)
    map.set(name, [run, ...(map.get(name) ?? [])])
  }
  for (const binding of bindings) {
    const key = apple ? (binding.mac ?? binding.key) : binding.key
    if (!key) continue
    add(key, binding.run)
    if (binding.shift) add(`shift+${key}`, binding.shift)
  }
  return map
}

/** The editing and moving keys every editor has. */
export const defaultKeymap: readonly CodeKeyBinding[] = [
  { key: 'arrowleft', run: cmd.cursorCharLeft, shift: cmd.selectCharLeft },
  { key: 'arrowright', run: cmd.cursorCharRight, shift: cmd.selectCharRight },
  {
    key: 'mod+arrowleft',
    mac: 'alt+arrowleft',
    run: cmd.cursorWordLeft,
    shift: cmd.selectWordLeft,
  },
  {
    key: 'mod+arrowright',
    mac: 'alt+arrowright',
    run: cmd.cursorWordRight,
    shift: cmd.selectWordRight,
  },
  { mac: 'mod+arrowleft', run: cmd.cursorLineStart, shift: cmd.selectLineStart },
  { mac: 'mod+arrowright', run: cmd.cursorLineEnd, shift: cmd.selectLineEnd },
  { key: 'home', run: cmd.cursorLineStart, shift: cmd.selectLineStart },
  { key: 'end', run: cmd.cursorLineEnd, shift: cmd.selectLineEnd },
  { key: 'arrowup', run: cmd.cursorLineUp, shift: cmd.selectLineUp },
  { key: 'arrowdown', run: cmd.cursorLineDown, shift: cmd.selectLineDown },
  { key: 'mod+home', mac: 'mod+arrowup', run: cmd.cursorDocStart, shift: cmd.selectDocStart },
  { key: 'mod+end', mac: 'mod+arrowdown', run: cmd.cursorDocEnd, shift: cmd.selectDocEnd },
  { mac: 'mod+home', run: cmd.cursorDocStart, shift: cmd.selectDocStart },
  { mac: 'mod+end', run: cmd.cursorDocEnd, shift: cmd.selectDocEnd },
  { key: 'pageup', run: cmd.cursorPageUp, shift: cmd.selectPageUp },
  { key: 'pagedown', run: cmd.cursorPageDown, shift: cmd.selectPageDown },
  { key: 'backspace', run: cmd.deleteCharBackward, shift: cmd.deleteCharBackward },
  { key: 'delete', run: cmd.deleteCharForward },
  { key: 'mod+backspace', mac: 'alt+backspace', run: cmd.deleteWordBackward },
  { key: 'mod+delete', mac: 'alt+delete', run: cmd.deleteWordForward },
  { mac: 'mod+backspace', run: cmd.deleteLineStart },
  { mac: 'mod+delete', run: cmd.deleteLineEnd },
  { mac: 'ctrl+k', run: cmd.deleteLineEnd },
  { key: 'enter', run: cmd.insertNewline, shift: cmd.insertNewline },
  { key: 'tab', run: cmd.insertTab, shift: cmd.indentLess },
  { key: 'mod+]', run: cmd.indentMore },
  { key: 'mod+[', run: cmd.indentLess },
  { key: 'mod+a', run: cmd.selectAll },
  { key: 'mod+z', run: cmd.undo },
  { key: 'mod+shift+z', run: cmd.redo },
  { key: 'mod+y', mac: 'mod+shift+z', run: cmd.redo },
  { key: 'escape', run: cmd.simplifySelection },
  { key: 'mod+/', run: cmd.toggleComment },
  { key: 'alt+arrowup', run: cmd.moveLineUp },
  { key: 'alt+arrowdown', run: cmd.moveLineDown },
  { key: 'shift+alt+arrowup', run: cmd.copyLineUp },
  { key: 'shift+alt+arrowdown', run: cmd.copyLineDown },
  { key: 'mod+shift+k', run: cmd.deleteLine },
  { key: 'mod+shift+\\', run: cmd.cursorMatchingBracket },
  { key: 'mod+shift+|', run: cmd.cursorMatchingBracket },
]
