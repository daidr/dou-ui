import { boundsOf, columnName, parseRange } from './address'
import type { SheetData, SheetGroup } from './model'

/*
 * Groups of rows or columns that fold away together. A sheet lists them as
 * whole rows (`'3:8'`) or whole columns (`'B:D'`); groups on the same axis
 * nest or stay apart, at most eight deep. A group's button sits on the line
 * that holds its heading or subtotal: the one before it, or after it when
 * the sheet's `groupSummary` says so.
 */

/** How deep groups may nest. */
export const MAX_GROUP_DEPTH = 8

/** How wide each lane of the outline beside the headers is. */
export const OUTLINE_LANE = 16

type Axis = 'row' | 'col'

/** A group of a sheet, laid out. */
export interface SheetGroupLines {
  /** Its place in the sheet's `groups`. */
  index: number
  axis: Axis
  /** Its first and last line. */
  start: number
  end: number
  /** 1 for a group inside no other. */
  depth: number
  collapsed: boolean
}

/** The lines a group's range covers, or `null` when it isn't whole rows or columns. */
export function groupSpan(range: string): { axis: Axis; start: number; end: number } | null {
  const parsed = parseRange(range)
  if (!parsed) return null
  const b = boundsOf(parsed)
  if (b.left === 0 && b.right === Infinity && b.bottom !== Infinity)
    return { axis: 'row', start: b.top, end: b.bottom }
  if (b.top === 0 && b.bottom === Infinity && b.right !== Infinity)
    return { axis: 'col', start: b.left, end: b.right }
  return null
}

/** A group's range for its lines: `'3:8'` or `'B:D'`. */
export const groupRange = (axis: Axis, start: number, end: number) =>
  axis === 'row' ? `${start + 1}:${end + 1}` : `${columnName(start)}:${columnName(end)}`

/** One axis of a sheet's groups. */
export class SheetGroupAxis {
  /** Lines inside a folded group. */
  readonly hidden = new Set<number>()
  /** The deepest a group nests; `0` without groups. */
  readonly depth: number

  constructor(
    /** Outer groups before the ones inside them. */
    readonly list: readonly SheetGroupLines[],
    /** Groups left out for crossing another or nesting too deep. */
    readonly dropped: number,
  ) {
    let depth = 0
    for (const g of list) {
      depth = Math.max(depth, g.depth)
      if (g.collapsed) for (let i = g.start; i <= g.end; i++) this.hidden.add(i)
    }
    this.depth = depth
  }

  /** The groups around a line, outer first. */
  around(line: number) {
    return this.list.filter((g) => g.start <= line && g.end >= line)
  }

  /** The group with exactly these lines. */
  find(start: number, end: number) {
    return this.list.find((g) => g.start === start && g.end === end)
  }

  /**
   * The line a group's button sits on: its summary line, before or after
   * it; the other side when that line is missing or inside a group beside
   * it; `-1` when neither side will do.
   */
  buttonLine(g: SheetGroupLines, count: number, summary: SheetGroupSummary = 'before') {
    const sides = summary === 'after' ? [g.end + 1, g.start - 1] : [g.start - 1, g.end + 1]
    for (const line of sides)
      if (
        line >= 0 &&
        line < count &&
        !this.list.some((o) => o !== g && o.depth >= g.depth && o.start <= line && o.end >= line)
      )
        return line
    return -1
  }

  /**
   * Why lines can't be grouped: a group they would cross, or `'deep'` for
   * nesting more than eight deep; `null` when they can.
   */
  problem(start: number, end: number): { cross: SheetGroupLines } | 'deep' | null {
    let around = 0
    let inside = 0
    for (const g of this.list) {
      const crosses =
        (g.start < start && g.end >= start && g.end < end) ||
        (g.start > start && g.start <= end && g.end > end)
      if (crosses) return { cross: g }
      if (g.start <= start && g.end >= end) around++
      else if (g.start >= start && g.end <= end) inside = Math.max(inside, g.depth - around)
    }
    return around + 1 + inside > MAX_GROUP_DEPTH ? 'deep' : null
  }

  /** The groups at a depth that sit right beside these lines, inside the same parent. */
  beside(start: number, end: number) {
    const parent = this.list.filter((g) => g.start <= start && g.end >= end).at(-1)
    const depth = (parent?.depth ?? 0) + 1
    return this.list.filter(
      (g) =>
        g.depth === depth &&
        (g.end === start - 1 || g.start === end + 1) &&
        (!parent || (g.start >= parent.start && g.end <= parent.end)),
    )
  }
}

/** Which side of a group holds its heading or subtotal, and its button. */
export type SheetGroupSummary = 'before' | 'after'

/** The groups of a sheet, laid out per axis. */
export class SheetGroups {
  static readonly EMPTY = new SheetGroups(undefined)

  readonly rows: SheetGroupAxis
  readonly cols: SheetGroupAxis

  constructor(
    groups: readonly SheetGroup[] | undefined,
    /** Whether a group is folded, when it isn't what the sheet says. */
    collapsed?: (group: SheetGroup, index: number) => boolean,
  ) {
    const rows: SheetGroupLines[] = []
    const cols: SheetGroupLines[] = []
    groups?.forEach((group, index) => {
      const span = groupSpan(group.range)
      if (!span) return
      const folded = collapsed ? collapsed(group, index) : !!group.collapsed
      ;(span.axis === 'row' ? rows : cols).push({ ...span, index, depth: 0, collapsed: folded })
    })
    this.rows = layOut(rows)
    this.cols = layOut(cols)
  }

  axis(axis: Axis) {
    return axis === 'row' ? this.rows : this.cols
  }
}

/** Gives each group its depth, leaving out those that cross another or nest too deep. */
function layOut(list: SheetGroupLines[]) {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the list built for it
  list.sort((a, b) => a.start - b.start || b.end - a.end || a.index - b.index)
  const kept: SheetGroupLines[] = []
  const open: SheetGroupLines[] = []
  let dropped = 0
  for (const g of list) {
    while (open.length && open.at(-1)!.end < g.start) open.pop()
    const parent = open.at(-1)
    if (
      (parent && (g.end > parent.end || (g.start === parent.start && g.end === parent.end))) ||
      open.length >= MAX_GROUP_DEPTH
    ) {
      dropped++
      continue
    }
    g.depth = open.length + 1
    open.push(g)
    kept.push(g)
  }
  return new SheetGroupAxis(kept, dropped)
}

const cache = new WeakMap<readonly SheetGroup[], SheetGroups>()

/** A sheet's groups, read once per list. */
export function groupsOf(sheet: SheetData): SheetGroups {
  const list = sheet.groups
  if (!list?.length) return SheetGroups.EMPTY
  let groups = cache.get(list)
  if (!groups) cache.set(list, (groups = new SheetGroups(list)))
  return groups
}
