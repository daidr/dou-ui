import type { CodeText } from './text'

/** How far bracket matching looks, in characters, so a huge text never stalls a key press. */
const SCAN_LIMIT = 20_000

export interface BracketMatch {
  /** The bracket next to the cursor. */
  from: number
  /** Its partner, or `null` when there is none within reach. */
  match: number | null
}

/**
 * The bracket at `pos` (the one after it, else the one before) and its
 * partner. `skip(pos)` tells whether a character is inside a string or a
 * comment, where brackets don't count.
 */
export function matchBracket(
  doc: CodeText,
  pos: number,
  brackets: string,
  skip?: (pos: number) => boolean,
): BracketMatch | null {
  const line = doc.lineAt(pos)
  const col = pos - line.from
  for (const at of [col, col - 1]) {
    const ch = line.text[at]
    if (ch === undefined) continue
    const index = brackets.indexOf(ch)
    if (index < 0) continue
    const from = line.from + at
    if (skip?.(from)) continue
    return { from, match: findPartner(doc, from, brackets, index, skip) }
  }
  return null
}

/** The partner of the bracket at `from`, which is `brackets[index]`. */
export function findPartner(
  doc: CodeText,
  from: number,
  brackets: string,
  index: number,
  skip?: (pos: number) => boolean,
): number | null {
  const open = index % 2 === 0
  const self = brackets[index]!
  const partner = brackets[open ? index + 1 : index - 1]!
  const dir = open ? 1 : -1
  let depth = 0
  let line = doc.lineAt(from)
  let col = from - line.from + dir
  let scanned = 0
  for (;;) {
    while (col >= 0 && col < line.text.length) {
      const ch = line.text[col]!
      if ((ch === self || ch === partner) && !skip?.(line.from + col)) {
        if (ch === self) depth++
        else if (depth === 0) return line.from + col
        else depth--
      }
      col += dir
      if (++scanned > SCAN_LIMIT) return null
    }
    const next = line.number + dir
    if (next < 1 || next > doc.lines) return null
    line = doc.line(next)
    col = dir > 0 ? 0 : line.text.length - 1
  }
}
