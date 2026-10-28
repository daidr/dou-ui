export type CommandValue = string | number

export interface CommandItem {
  /** Unique among the items. */
  value: CommandValue
  /** What the item reads as, and what the search matches first. */
  label: string
  /** Items with the same group are listed together under its name. */
  group?: string
  /** A quieter line after the label; also searched. */
  description?: string
  /** Other words that should find this item, e.g. synonyms. */
  keywords?: string[]
  /** Keys shown at the end, e.g. `['⌘', 'K']`. Only shown, not bound. */
  shortcut?: string[]
  disabled?: boolean
  [extra: string]: unknown
}

/** How well an item matched, with the positions in its label to pick out. */
export interface CommandMatch {
  score: number
  indices: number[]
}

export interface CommandProps {
  items: CommandItem[]
  /** The search text, bound with `v-model:query`. */
  query?: string
  placeholder?: string
  /** Shown when nothing matches. Defaults to the locale's. */
  emptyText?: string
  /**
   * Scores an item against the query; `null` hides it. Defaults to a
   * fuzzy match: the letters in order, ranked by how close together and
   * how near word starts they fall.
   */
  filter?: (query: string, item: CommandItem) => CommandMatch | null
  /** Wrap from the last item to the first with the arrow keys. */
  loop?: boolean
  /** The height the list scrolls past. A number is in px. */
  maxHeight?: number | string
  /** Names the search box when there is no visible label. */
  ariaLabel?: string
}

export interface CommandEmits {
  'update:query': [query: string]
  /** An item was chosen with a click or `Enter`. */
  select: [item: CommandItem]
}

export interface CommandSlots {
  /** Replaces an item's content. `indices` are the matched positions in its label. */
  item?: (props: { item: CommandItem; active: boolean; indices: number[] }) => unknown
  /** Before the search box, replacing the magnifier. */
  prefix?: () => unknown
  /** Shown when nothing matches. */
  empty?: () => unknown
  /** Under the list, e.g. hints about keys. */
  footer?: () => unknown
}

export interface CommandExpose {
  focus: () => void
}

export interface CommandDialogProps extends CommandProps {
  /** Whether the palette is open, bound with `v-model:open`. */
  open?: boolean
  /**
   * A key that opens and closes the palette from anywhere, e.g. `mod+k`;
   * `mod` is `⌘` on Apple systems and `Ctrl` elsewhere. `false` binds none.
   */
  hotkey?: string | false
  /** Close after an item is chosen. */
  closeOnSelect?: boolean
  /** The width of the panel; a number is in px. */
  width?: string | number
}

export interface CommandDialogEmits extends CommandEmits {
  'update:open': [open: boolean]
}

const isBoundary = (text: string, index: number) => {
  if (index === 0) return true
  const before = text[index - 1]!
  const here = text[index]!
  return (
    /[\s\-_./:]/.test(before) || (before === before.toLowerCase() && here !== here.toLowerCase())
  )
}

/**
 * Match `query` against `text` as a subsequence, ignoring case. Letters
 * that follow each other, sit at the start of a word, or begin the text
 * score higher; a plain substring scores highest of all.
 */
export function fuzzyMatch(text: string, query: string): CommandMatch | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return { score: 0, indices: [] }
  const haystack = text.toLowerCase()

  const at = haystack.indexOf(needle)
  if (at >= 0) {
    const indices = Array.from({ length: needle.length }, (_, offset) => at + offset)
    return { score: 100 + (at === 0 ? 20 : isBoundary(text, at) ? 10 : 0) - at * 0.1, indices }
  }

  const indices: number[] = []
  let score = 0
  let from = 0
  for (const char of needle) {
    if (char === ' ') continue
    const index = haystack.indexOf(char, from)
    if (index < 0) return null
    score += 1
    if (indices.length && index === indices.at(-1)! + 1) score += 5
    if (isBoundary(text, index)) score += 8
    indices.push(index)
    from = index + 1
  }
  return { score: score - (indices[0] ?? 0) * 0.1, indices }
}

/** The default `filter`: the label first, then the description and keywords. */
export function matchCommand(query: string, item: CommandItem): CommandMatch | null {
  const label = fuzzyMatch(item.label, query)
  if (label) return label
  for (const extra of [item.description, ...(item.keywords ?? [])]) {
    const match = extra ? fuzzyMatch(extra, query) : null
    if (match) return { score: match.score / 2, indices: [] }
  }
  return null
}
