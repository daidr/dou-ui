export interface HighlightPart {
  text: string
  /** Whether this part matched a keyword. */
  match: boolean
}

export interface HighlightOptions {
  caseSensitive?: boolean
  /** Only match whole words: a keyword next to a letter or digit is skipped. */
  wholeWord?: boolean
}

// `-` only means something inside a class, and escaping it is an error with the `u` flag
const escape = (text: string) => text.replace(/[$()*+./?[\\\]^{|}]/g, '\\$&')

/**
 * Split text around every match of the keywords. Longer keywords win
 * where two overlap, and empty keywords are ignored.
 */
export function splitHighlight(
  text: string,
  keywords: string | readonly string[] | null | undefined,
  options: HighlightOptions = {},
): HighlightPart[] {
  const words = (typeof keywords === 'string' ? [keywords] : (keywords ?? []))
    .map((word) => word.trim())
    .filter(Boolean)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  words.sort((a, b) => b.length - a.length)
  if (!text || !words.length) return text ? [{ text, match: false }] : []
  let source = words.map(escape).join('|')
  if (options.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`
  const pattern = new RegExp(source, options.caseSensitive ? 'gu' : 'giu')
  const parts: HighlightPart[] = []
  let last = 0
  for (const found of text.matchAll(pattern)) {
    const at = found.index
    if (at > last) parts.push({ text: text.slice(last, at), match: false })
    parts.push({ text: found[0], match: true })
    last = at + found[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false })
  return parts
}
