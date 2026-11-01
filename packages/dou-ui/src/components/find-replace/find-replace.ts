export interface FindReplaceProps {
  /** The text to find, bound with `v-model:search`. */
  search?: string
  /** The text that replaces a match, bound with `v-model:replace`. */
  replace?: string
  /** Whether the replace box is shown, bound with `v-model:replacing`. */
  replacing?: boolean
  /** How many matches there are. */
  count?: number
  /** Which match is current, from 0; `-1` when none is. */
  current?: number
  /** There are more matches than `count`; the count reads “over …”. */
  capped?: boolean
  /** A search is under way, such as one waiting for typing to pause; the count is left blank. */
  searching?: boolean
  /** Why the search can't be run, such as a broken regular expression. Shown in place of the count, and the box turns red. */
  error?: string
  /** Only find: no replace box, and the replace keys do nothing. */
  readonly?: boolean
}

export interface FindReplaceEmits {
  'update:search': [search: string]
  'update:replace': [replace: string]
  'update:replacing': [replacing: boolean]
  /** Go to the next match (Enter). */
  next: []
  /** Go to the previous match (Shift+Enter). */
  previous: []
  /** Replace the current match (Enter in the replace box). */
  replaceOne: []
  /** Replace every match (Ctrl/⌘+Enter in the replace box). */
  replaceAll: []
  /** Close the panel (Escape). */
  close: []
}

export interface FindReplaceSlots {
  /** Toggles inside the find box, such as “match case”; use `DouToggle` with `size="sm"`. */
  options?: () => unknown
}

export interface FindReplaceExpose {
  /** Puts the focus in the find box, or the replace box, with its text selected. */
  focus: (which?: 'find' | 'replace') => void
}
