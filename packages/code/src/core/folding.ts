import { findPartner } from './brackets'
import type { CodeText } from './text'

/** A folded block: the line ending at `from` stays, the lines after it up to the one ending at `to` are hidden. */
export interface CodeFold {
  from: number
  to: number
}

/** How far down an indented block is looked at before it counts as running to that point. */
const INDENT_SCAN = 50_000

function indentOf(text: string, tabSize: number) {
  let col = 0
  for (const ch of text) {
    if (ch === ' ') col++
    else if (ch === '\t') col = (Math.floor(col / tabSize) + 1) * tabSize
    else return col
  }
  return -1
}

/**
 * The last line a fold starting at line `n` would hide, or `null` when the
 * line starts no block. A line ending in an open bracket folds up to the
 * line before its partner, so the closing bracket stays in view; any other
 * line folds the lines indented deeper below it.
 */
export function foldEndAt(
  doc: CodeText,
  n: number,
  options: { brackets?: string; skip?: (pos: number) => boolean; tabSize?: number } = {},
): number | null {
  if (n < 1 || n >= doc.lines) return null
  const line = doc.line(n)
  const text = line.text
  const { brackets, skip } = options
  if (brackets) {
    // The last opening bracket whose partner is on a later line.
    for (let col = text.length - 1; col >= 0; col--) {
      const index = brackets.indexOf(text[col]!)
      if (index < 0 || skip?.(line.from + col)) continue
      if (index % 2 === 1) break
      const partner = findPartner(doc, line.from + col, brackets, index, skip)
      if (partner === null) continue
      const end = doc.lineAt(partner).number
      if (end > n + 1) return end - 1
      if (end > n) return null
    }
  }
  const tabSize = options.tabSize ?? 2
  const indent = indentOf(text, tabSize)
  if (indent < 0) return null
  let end = n
  const last = Math.min(doc.lines, n + INDENT_SCAN)
  for (let k = n + 1; k <= last; k++) {
    const own = indentOf(doc.line(k).text, tabSize)
    if (own < 0) continue
    if (own <= indent) break
    end = k
  }
  return end > n ? end : null
}

/** The lines hidden by `folds`, as sorted ranges that don't overlap. */
export function hiddenLines(doc: CodeText, folds: readonly CodeFold[]): Array<[number, number]> {
  const ranges = folds
    .map((fold): [number, number] => [doc.lineAt(fold.from).number + 1, doc.lineAt(fold.to).number])
    .filter(([from, to]) => to >= from)
  return mergeRanges(ranges)
}

/** Line ranges sorted, with the ones that overlap or touch joined. */
export function mergeRanges(
  ranges: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  const sorted = ranges.slice().sort((a, b) => a[0] - b[0])
  const out: Array<[number, number]> = []
  for (const range of sorted) {
    const last = out[out.length - 1]
    if (last && range[0] <= last[1] + 1) last[1] = Math.max(last[1], range[1])
    else out.push([range[0], range[1]])
  }
  return out
}
