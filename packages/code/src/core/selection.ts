import type { ChangeSet } from './changes'

/** One selected range. `anchor` stays put while `head` (the cursor) moves; equal means a bare cursor. */
export interface CodeRange {
  anchor: number
  head: number
}

/** The selection: one or more ranges, sorted and apart, and which one is the main one. */
export interface CodeSelection {
  ranges: CodeRange[]
  main: number
}

export const rangeFrom = (range: CodeRange) => Math.min(range.anchor, range.head)
export const rangeTo = (range: CodeRange) => Math.max(range.anchor, range.head)
export const isEmptyRange = (range: CodeRange) => range.anchor === range.head

/** A selection of one range; just a cursor when `head` is left out. */
export function selectionOf(anchor: number, head = anchor): CodeSelection {
  return { ranges: [{ anchor, head }], main: 0 }
}

/** The main range. */
export const mainRange = (selection: CodeSelection) =>
  selection.ranges[selection.main] ?? selection.ranges[0]!

/**
 * Clamps every range into a text of `length`, sorts them and joins the ones
 * that overlap (or are cursors at the same spot). The main range keeps its
 * place in whichever range it ended up in.
 */
export function normalizeSelection(selection: CodeSelection, length: number): CodeSelection {
  const clamp = (pos: number) => Math.max(0, Math.min(length, Math.round(pos) || 0))
  const main = mainRange(selection)
  const ranges = selection.ranges.map((range) => ({
    anchor: clamp(range.anchor),
    head: clamp(range.head),
    main: range === main,
  }))
  if (!ranges.length) return selectionOf(0)
  ranges.sort((a, b) => Math.min(a.anchor, a.head) - Math.min(b.anchor, b.head))
  const out: (CodeRange & { main: boolean })[] = []
  for (const range of ranges) {
    const last = out[out.length - 1]
    const from = rangeFrom(range)
    if (last) {
      const lastTo = rangeTo(last)
      const overlaps =
        from < lastTo || (from === lastTo && (isEmptyRange(range) || isEmptyRange(last)))
      if (overlaps) {
        const start = Math.min(rangeFrom(last), from)
        const end = Math.max(lastTo, rangeTo(range))
        // Keep the direction of the range that was reaching outward.
        const backward = (range.main ? range : last).head < (range.main ? range : last).anchor
        last.anchor = backward ? end : start
        last.head = backward ? start : end
        last.main ||= range.main
        continue
      }
    }
    out.push(range)
  }
  const index = Math.max(
    0,
    out.findIndex((range) => range.main),
  )
  return { ranges: out.map(({ anchor, head }) => ({ anchor, head })), main: index }
}

/** Moves every range through `changes`. Cursors stay after text typed at them. */
export function mapSelection(selection: CodeSelection, changes: ChangeSet): CodeSelection {
  if (changes.empty) return selection
  return {
    ranges: selection.ranges.map((range) => {
      if (isEmptyRange(range)) {
        const pos = changes.mapPos(range.head, 1)
        return { anchor: pos, head: pos }
      }
      // A range grows to take in text typed at its edges only from the inside.
      const forward = range.head >= range.anchor
      return {
        anchor: changes.mapPos(range.anchor, forward ? 1 : -1),
        head: changes.mapPos(range.head, forward ? -1 : 1),
      }
    }),
    main: selection.main,
  }
}

/** Whether two selections are the same. */
export function sameSelection(a: CodeSelection, b: CodeSelection): boolean {
  if (a === b) return true
  if (a.main !== b.main || a.ranges.length !== b.ranges.length) return false
  return a.ranges.every(
    (range, i) => range.anchor === b.ranges[i]!.anchor && range.head === b.ranges[i]!.head,
  )
}
