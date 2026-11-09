export interface StreamTextProps {
  /** The text so far. While streaming it grows; each new part is revealed smoothly. */
  content?: string
  /** More text is still coming. Shows the caret and keeps revealing. */
  streaming?: boolean
  /**
   * Reveal new text gradually. Turned off, it appears as it arrives. Text
   * that is already there when the component mounts outside of streaming,
   * e.g. a past message, is shown at once either way.
   */
  smooth?: boolean
  /** The slowest reveal, in characters per second. A larger backlog is caught up faster. */
  speed?: number
  /** Show a blinking caret after the text while it is coming in. */
  caret?: boolean
  /** The element to render. */
  as?: string
}

export interface StreamTextEmits {
  /** All text is revealed and `streaming` is off. */
  done: []
}

export interface StreamTextSlots {
  /**
   * Renders the revealed text, e.g. through a Markdown renderer. Defaults
   * to plain text that keeps line breaks.
   */
  default?: (props: { text: string; done: boolean }) => unknown
  /**
   * Content that follows the last character on the same line, e.g. an
   * "edited" mark; after the caret while streaming.
   */
  trailing?: () => unknown
}

export interface StreamTextExpose {
  /** Reveal everything received so far at once. */
  flush: () => void
}

/**
 * Where to cut `text` near `index` without splitting a surrogate pair,
 * so an emoji never shows as half a character.
 */
export function safeCut(text: string, index: number): number {
  if (index <= 0) return 0
  if (index >= text.length) return text.length
  const code = text.charCodeAt(index - 1)
  return code >= 0xd800 && code <= 0xdbff ? index + 1 : index
}
