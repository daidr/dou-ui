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
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 32) col++
    else if (code === 9) col = (Math.floor(col / tabSize) + 1) * tabSize
    else return col
  }
  return -1
}

/** Whether the bracket at `col` (`brackets[index]`, an opening one) is closed later on the same line, which starts at `start`. */
function closesOnLine(
  text: string,
  col: number,
  brackets: string,
  index: number,
  skip: ((pos: number) => boolean) | undefined,
  start: number,
) {
  const self = brackets[index]!
  const partner = brackets[index + 1]!
  let depth = 0
  for (let c = col + 1; c < text.length; c++) {
    const ch = text[c]
    if ((ch !== self && ch !== partner) || (skip && skip(start + c))) continue
    if (ch === self) depth++
    else if (depth === 0) return true
    else depth--
  }
  return false
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
  options: {
    brackets?: string
    skip?: (pos: number) => boolean
    tabSize?: number
    /** The text of line `n`, when the caller has the lines at hand already. */
    lineText?: (n: number) => string
  } = {},
): number | null {
  if (n < 1 || n >= doc.lines) return null
  const lineText = options.lineText ?? ((k: number) => doc.lineText(k))
  const text = lineText(n)
  const { brackets, skip } = options
  if (brackets) {
    // Where the line starts, found only when a bracket needs it.
    let start = -1
    // The last opening bracket whose partner is on a later line.
    for (let col = text.length - 1; col >= 0; col--) {
      const index = brackets.indexOf(text[col]!)
      if (index < 0) continue
      if (skip && start < 0) start = doc.line(n).from
      if (skip && skip(start + col)) continue
      if (index % 2 === 1) break
      // A partner later on the same line is found without leaving it.
      if (closesOnLine(text, col, brackets, index, skip, start)) continue
      if (start < 0) start = doc.line(n).from
      const partner = findPartner(doc, start + col, brackets, index, skip)
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
    const own = indentOf(lineText(k), tabSize)
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
