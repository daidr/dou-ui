export interface FindReplaceProps {
  /** How many matches there are. */
  count?: number
  /** Which match is current, from 0; `-1` when none is. */
  current?: number
  /** There are more matches than `count`; the count reads “over …”. */
  capped?: boolean
  /** Why the search can't be run, such as a broken regular expression. Shown in place of the count, and the box turns red. */
  error?: string
  /** Only find: no replace box, and the replace keys do nothing. */
  readonly?: boolean
}

export interface FindReplaceEmits {
  /** Go to the next match (Enter). */
  next: []
  /** Go to the previous match (Shift+Enter). */
  previous: []
  /** Replace the current match (Enter in the replace box). */
  replace: []
  /** Replace every match (Ctrl/⌘+Enter in the replace box). */
  replaceAll: []
  /** Close the panel (Escape). */
  close: []
}
