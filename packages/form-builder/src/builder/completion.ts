import { referenceSource } from './condition'

/** What an expression can read, for completions. */
export interface CompletionScope {
  /** Paths under `values`, with what to show beside each. */
  names: readonly { path: string; label?: string }[]
  /** Paths under `item`; `undefined` where there is no list item. */
  itemNames?: readonly { path: string; label?: string }[]
  /** Whether `value` (the field's own value) can be read. */
  value?: boolean
  functions: readonly string[]
}

export interface Completion {
  /** What the list shows. */
  label: string
  /** A quieter text after it, e.g. the field's label. */
  description?: string
  /** The whole text once chosen. */
  text: string
  /** Where the caret goes in `text`. */
  caret: number
}

const WORD = /[A-Za-z_$À-￿][\w$.À-￿]*$/
const LIMIT = 50

/** Whether the caret is inside quoted text, where nothing is completed. */
function inString(text: string) {
  let quote = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = ''
    } else if (char === "'" || char === '"') quote = char
  }
  return !!quote
}

/**
 * What can be typed at the caret: field paths after `values.` or `item.`,
 * else the names an expression starts with and the functions.
 */
export function completeExpression(
  text: string,
  caret: number,
  scope: CompletionScope,
  labels: { values: string; item: string; value: string },
): Completion[] {
  const before = text.slice(0, caret)
  const match = WORD.exec(before)
  if (!match || inString(before)) return []
  const word = match[0]
  const start = caret - word.length
  const make = (label: string, insert: string, description?: string): Completion => ({
    label,
    description,
    text: text.slice(0, start) + insert + text.slice(caret),
    caret: start + insert.length,
  })

  const dot = word.indexOf('.')
  if (dot >= 0) {
    const root = word.slice(0, dot)
    const rest = word.slice(dot + 1)
    const list = root === 'values' ? scope.names : root === 'item' ? scope.itemNames : undefined
    if (!list) return []
    return list
      .filter(({ path }) => path.startsWith(rest) && path !== rest)
      .slice(0, LIMIT)
      .map(({ path, label }) => make(path, referenceSource(root as 'values' | 'item', path), label))
  }

  const roots: Completion[] = [make('values.', 'values.', labels.values)]
  if (scope.itemNames) roots.push(make('item.', 'item.', labels.item))
  if (scope.value) roots.push(make('value', 'value', labels.value))
  const functions = scope.functions.map((name) => make(`${name}()`, `${name}(`))
  return [...roots, ...functions].filter(
    (completion) => completion.label.startsWith(word) && completion.label !== word,
  )
}
