export interface HighlightProps {
  /** The text to show. */
  text?: string
  /** What to mark: one keyword or several. */
  keywords?: string | string[]
  /** Tell upper and lower case apart. */
  caseSensitive?: boolean
  /** Only mark whole words, not a keyword inside a longer word. */
  wholeWord?: boolean
}

export interface HighlightSlots {
  /** Replaces each marked part. */
  mark?: (props: { text: string }) => unknown
}
