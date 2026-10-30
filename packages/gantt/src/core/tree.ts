import { clampProgress, spanOf, type GanttTask, type TaskSpan } from './model'

export interface GanttRow {
  task: GanttTask
  /** Nesting level, from 0. */
  depth: number
  /** Position among the shown rows; `-1` when a collapsed parent hides it. */
  index: number
  /** Number of direct children. */
  children: number
  /** Has children, so its dates and progress come from them. */
  summary: boolean
  milestone: boolean
  /** Its own dates, or for a summary the dates its children cover. */
  span: TaskSpan | null
  progress: number
}

export interface GanttTree {
  /** The rows to show, top to bottom. */
  rows: GanttRow[]
  /** Every task's row, shown or not. */
  byId: Map<string, GanttRow>
  /** Children in display order; roots under `undefined`. */
  childrenOf: Map<string | undefined, GanttTask[]>
}

/**
 * Orders siblings: by `order` where given, otherwise as in the array. A
 * sibling without `order` sorts right after the one before it in the array.
 */
function sortSiblings(list: { task: GanttTask; index: number }[]) {
  let key = ''
  const keyed = list.map((item) => {
    if (item.task.order != null) key = item.task.order
    return { ...item, key }
  })
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index))
  return keyed.map((item) => item.task)
}

/**
 * Lays the flat task list out as a tree: rows in display order, summaries
 * worked out from their children. A `parent` that doesn't exist, or that
 * would make a loop, is ignored and the task becomes a root.
 */
export function buildTree(tasks: readonly GanttTask[]): GanttTree {
  const ids = new Map(tasks.map((task) => [task.id, task]))

  // follow each parent chain; a chain that comes back to itself is cut
  const parentOf = new Map<string, string | undefined>()
  for (const task of tasks) {
    let parent = task.parent != null && ids.has(task.parent) ? task.parent : undefined
    const seen = new Set([task.id])
    for (let up = parent; up != null;) {
      if (seen.has(up)) {
        parent = undefined
        break
      }
      seen.add(up)
      const next = ids.get(up)!.parent
      up = next != null && ids.has(next) ? next : undefined
    }
    parentOf.set(task.id, parent)
  }

  const groups = new Map<string | undefined, { task: GanttTask; index: number }[]>()
  tasks.forEach((task, index) => {
    const parent = parentOf.get(task.id)
    const list = groups.get(parent)
    if (list) list.push({ task, index })
    else groups.set(parent, [{ task, index }])
  })
  const childrenOf = new Map<string | undefined, GanttTask[]>()
  for (const [parent, list] of groups) childrenOf.set(parent, sortSiblings(list))

  const byId = new Map<string, GanttRow>()
  const rows: GanttRow[] = []

  const visit = (task: GanttTask, depth: number, shown: boolean): GanttRow => {
    const kids = childrenOf.get(task.id) ?? []
    const row: GanttRow = {
      task,
      depth,
      index: shown ? rows.length : -1,
      children: kids.length,
      summary: kids.length > 0,
      milestone: kids.length === 0 && task.type === 'milestone',
      span: null,
      progress: 0,
    }
    byId.set(task.id, row)
    if (shown) rows.push(row)

    if (!kids.length) {
      row.span = spanOf(task)
      row.progress = clampProgress(task.progress)
      return row
    }
    let start = Infinity
    let end = -Infinity
    let dateOnly = true
    let weighted = 0
    let weight = 0
    for (const child of kids) {
      const sub = visit(child, depth + 1, shown && !task.collapsed)
      if (!sub.span) continue
      start = Math.min(start, sub.span.start)
      end = Math.max(end, sub.span.end)
      dateOnly &&= sub.span.dateOnly
      if (sub.milestone) continue
      const length = sub.span.end - sub.span.start
      weighted += sub.progress * length
      weight += length
    }
    if (start <= end) row.span = { start, end, dateOnly }
    row.progress = weight ? weighted / weight : 0
    return row
  }

  for (const task of childrenOf.get(undefined) ?? []) visit(task, 0, true)
  return { rows, byId, childrenOf }
}
