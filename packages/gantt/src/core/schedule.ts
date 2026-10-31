import {
  endKeepingWork,
  nextWorkTime,
  resolveCalendar,
  shiftWorkdays,
  shiftWorkMinutes,
  startKeepingWork,
  workIn,
  type GanttCalendar,
  type WorkCalendar,
} from './calendar'
import { parseLag } from './links'
import { writeSpan, type GanttLink, type GanttTask } from './model'
import { MINUTES_PER_DAY } from './time'
import type { GanttDocument } from './transaction'
import { buildTree } from './tree'

/*
 * Scheduling works on leaf tasks. A link to a summary applies to each of
 * its subtasks; a link from a summary reads the span its subtasks cover.
 * Every comparison is in working time, so a task that ends on Friday and
 * one that starts on Monday are back to back.
 *
 * A milestone is a point. Without a time it stands at the end of its day:
 * a task that finishes on Friday is followed by a milestone on Friday, and
 * a task after that milestone starts on Monday.
 */

export interface GanttScheduleOptions {
  /** Which days and hours are worked; the chart's `calendar`. */
  calendar?: GanttCalendar | WorkCalendar
  /** Also bring tasks earlier, to the earliest their links allow. Only tasks with links in move. */
  pull?: boolean
  /** Tasks to leave where they are, e.g. the ones just moved by hand; `locked` tasks always stay. */
  fixed?: Iterable<string>
}

export interface GanttSchedule {
  /** The new dates of the tasks that move, written in each task's own style. */
  moves: Map<string, Pick<GanttTask, 'start' | 'end'>>
  /** Links still not kept afterwards: into a locked or fixed task, or on a loop. */
  violated: Set<string>
  /** Tasks on a loop of links, or after one; they are left where they are. */
  cycle: string[]
}

export interface GanttCriticalPath {
  /** Tasks with no slack: any delay to them delays the end of the plan. */
  tasks: Set<string>
  /** Links between critical tasks that drive the later one. */
  links: Set<string>
}

interface Item {
  task: GanttTask
  start: number
  end: number
  dateOnly: boolean
  milestone: boolean
}

interface Graph {
  calendar: WorkCalendar
  items: Map<string, Item>
  /** Each task's scheduled leaves: itself for a leaf, its subtasks for a summary. */
  leavesOf: (id: string) => Item[]
  /** Links that point at each leaf. */
  incoming: Map<string, GanttLink[]>
  /** Links that leave from each leaf. */
  outgoing: Map<string, GanttLink[]>
  /** Leaves in an order where every link points forward. */
  order: Item[]
  /** Leaves left out of `order`: on or after a loop. */
  cycle: string[]
}

const toCalendar = (calendar: GanttScheduleOptions['calendar']): WorkCalendar =>
  calendar && 'isWorkday' in calendar ? calendar : resolveCalendar(calendar)

function push(map: Map<string, GanttLink[]>, id: string, link: GanttLink) {
  const list = map.get(id)
  if (list) list.push(link)
  else map.set(id, [link])
}

function buildGraph(doc: GanttDocument, calendar: WorkCalendar): Graph {
  const tree = buildTree(doc.tasks)
  const items = new Map<string, Item>()
  for (const row of tree.byId.values()) {
    if (row.summary || !row.span) continue
    const { start, end, dateOnly } = row.span
    // a whole-day milestone stands at the end of its day
    const at = row.milestone && dateOnly ? start + MINUTES_PER_DAY / 2 : start
    items.set(row.task.id, {
      task: row.task,
      start: at,
      end: row.milestone ? at : end,
      dateOnly,
      milestone: row.milestone,
    })
  }

  const leafCache = new Map<string, Item[]>()
  const leavesOf = (id: string): Item[] => {
    const cached = leafCache.get(id)
    if (cached) return cached
    const item = items.get(id)
    const out = item ? [item] : []
    if (!item) for (const child of tree.childrenOf.get(id) ?? []) out.push(...leavesOf(child.id))
    leafCache.set(id, out)
    return out
  }

  const incoming = new Map<string, GanttLink[]>()
  const outgoing = new Map<string, GanttLink[]>()
  const next = new Map<string, Set<string>>()
  const degree = new Map<string, number>()
  for (const id of items.keys()) degree.set(id, 0)
  for (const link of doc.links) {
    const from = leavesOf(link.from)
    const to = leavesOf(link.to)
    // a link between a summary and its own subtask means nothing
    if (!from.length || !to.length || from.some((item) => to.includes(item))) continue
    for (const item of to) push(incoming, item.task.id, link)
    for (const item of from) push(outgoing, item.task.id, link)
    for (const a of from) {
      let set = next.get(a.task.id)
      if (!set) next.set(a.task.id, (set = new Set()))
      for (const b of to) {
        if (set.has(b.task.id)) continue
        set.add(b.task.id)
        degree.set(b.task.id, degree.get(b.task.id)! + 1)
      }
    }
  }

  const order: Item[] = []
  const queue = [...items.keys()].filter((id) => degree.get(id) === 0)
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!
    order.push(items.get(id)!)
    for (const to of next.get(id) ?? []) {
      const left = degree.get(to)! - 1
      degree.set(to, left)
      if (left === 0) queue.push(to)
    }
  }
  const cycle = [...degree].filter(([, left]) => left > 0).map(([id]) => id)
  return { calendar, items, leavesOf, incoming, outgoing, order, cycle }
}

/** `at` moved by a link's lag, in working days or working minutes. */
function shiftByLag(
  calendar: WorkCalendar,
  at: number,
  link: GanttLink,
  dateOnly: boolean,
  sign = 1,
) {
  const lag = parseLag(link.lag) ?? { amount: 0, unit: 'day' as const }
  if (!lag.amount) return at
  const perDay = calendar.hours.reduce((sum, [open, close]) => sum + close - open, 0)
  if (dateOnly) {
    const days = lag.unit === 'day' ? lag.amount : lag.amount / perDay
    // a part of a day still takes the day
    return shiftWorkdays(calendar, Math.ceil(at / MINUTES_PER_DAY) * MINUTES_PER_DAY, sign * days)
  }
  const minutes = lag.unit === 'day' ? lag.amount * perDay : lag.amount
  return shiftWorkMinutes(calendar, at, sign * minutes)
}

/** Where the `from` side of a link is: the start or the end its leaves cover. */
function anchorOf(graph: Graph, link: GanttLink) {
  const type = link.type ?? 'fs'
  const leaves = graph.leavesOf(link.from)
  return type === 'fs' || type === 'ff'
    ? Math.max(...leaves.map((item) => item.end))
    : Math.min(...leaves.map((item) => item.start))
}

/** The time a link asks of its `to` side, and which end of it. */
function requirement(graph: Graph, link: GanttLink, dateOnly: boolean) {
  const type = link.type ?? 'fs'
  const at = shiftByLag(graph.calendar, anchorOf(graph, link), link, dateOnly)
  return { at, end: type === 'ff' || type === 'sf' }
}

/** `a` is not before `b`, counting only working time. */
const notBefore = (calendar: WorkCalendar, a: number, b: number, dateOnly: boolean) =>
  a >= b || workIn(calendar, a, b, dateOnly) === 0

/** The earliest a whole-day milestone can stand at or after `at`: the end of a working day. */
function milestoneAt(calendar: WorkCalendar, at: number, dateOnly: boolean) {
  if (!dateOnly) return nextWorkTime(calendar, at, false)
  let day = Math.ceil(at / MINUTES_PER_DAY) - 1
  while (!calendar.isWorkday(day) && day < at / MINUTES_PER_DAY + 3660) day++
  return (day + 1) * MINUTES_PER_DAY
}

/** The earliest start for a leaf that keeps all its incoming links, or `null` without any. */
function earliestStart(graph: Graph, item: Item) {
  const links = graph.incoming.get(item.task.id)
  if (!links?.length) return null
  const { calendar } = graph
  let earliest = -Infinity
  for (const link of links) {
    const need = requirement(graph, link, item.dateOnly)
    let start: number
    if (item.milestone) start = need.at
    else if (need.end) start = startKeepingWork(calendar, item, need.at)
    else start = need.at
    earliest = Math.max(earliest, start)
  }
  return item.milestone
    ? milestoneAt(calendar, earliest, item.dateOnly)
    : nextWorkTime(calendar, earliest, item.dateOnly)
}

/** Whether a link is kept by the spans in `graph`. */
function keeps(graph: Graph, link: GanttLink) {
  const to = graph.leavesOf(link.to)
  if (!to.length || !graph.leavesOf(link.from).length) return true
  return to.every((item) => {
    const need = requirement(graph, link, item.dateOnly)
    return notBefore(graph.calendar, need.end ? item.end : item.start, need.at, item.dateOnly)
  })
}

/** Writes an item's span back as task dates. */
function written(item: Item) {
  const start = item.milestone && item.dateOnly ? item.start - MINUTES_PER_DAY / 2 : item.start
  return writeSpan(item.task, start, item.milestone ? start : item.end)
}

/**
 * Moves tasks so that every link is kept: each task starts no earlier than
 * its links allow, keeping its working time. By default tasks are only
 * pushed later; `pull` also brings linked tasks earlier. Locked and fixed
 * tasks stay, and links into them may stay broken.
 *
 * Takes time in proportion to the tasks and links. Nothing is changed:
 * apply `moves` in a transaction, or call the chart's `schedule()`.
 */
export function computeSchedule(
  doc: GanttDocument,
  options: GanttScheduleOptions = {},
): GanttSchedule {
  const calendar = toCalendar(options.calendar)
  const graph = buildGraph(doc, calendar)
  const fixed = new Set(options.fixed)
  const moves = new Map<string, Pick<GanttTask, 'start' | 'end'>>()
  for (const item of graph.order) {
    if (item.task.locked || fixed.has(item.task.id)) continue
    const start = earliestStart(graph, item)
    if (start == null) continue
    if (options.pull ? start === item.start : notBefore(calendar, item.start, start, item.dateOnly))
      continue
    const end = item.milestone ? start : endKeepingWork(calendar, item, start)
    item.start = start
    item.end = end
    moves.set(item.task.id, written(item))
  }
  const violated = new Set(doc.links.filter((link) => !keeps(graph, link)).map((link) => link.id))
  return { moves, violated, cycle: graph.cycle }
}

/** Links whose `to` side starts (or ends) before the link allows; for manual scheduling. */
export function findBrokenLinks(
  doc: GanttDocument,
  options: Pick<GanttScheduleOptions, 'calendar'> = {},
) {
  const graph = buildGraph(doc, toCalendar(options.calendar))
  return new Set(doc.links.filter((link) => !keeps(graph, link)).map((link) => link.id))
}

/**
 * The tasks that decide when the plan ends: working back from the last
 * end, each task gets the latest end its successors allow, and the ones
 * with no working time to spare are critical. Reads the dates as they
 * are; tasks on a loop of links are left out.
 */
export function computeCriticalPath(
  doc: GanttDocument,
  options: Pick<GanttScheduleOptions, 'calendar'> = {},
): GanttCriticalPath {
  const cal = toCalendar(options.calendar)
  const graph = buildGraph(doc, cal)
  const out: GanttCriticalPath = { tasks: new Set(), links: new Set() }
  if (!graph.order.length) return out
  const finish = Math.max(...graph.order.map((item) => item.end))
  /** The latest start and end of each leaf. */
  const late = new Map<string, { start: number; end: number }>()

  for (let i = graph.order.length - 1; i >= 0; i--) {
    const item = graph.order[i]!
    let latestEnd = finish
    for (const link of graph.outgoing.get(item.task.id) ?? []) {
      const type = link.type ?? 'fs'
      for (const to of graph.leavesOf(link.to)) {
        const bound = late.get(to.task.id)
        if (!bound) continue
        const at = shiftByLag(
          cal,
          type === 'ff' || type === 'sf' ? bound.end : bound.start,
          link,
          item.dateOnly,
          -1,
        )
        // a link from the start bounds the start; turn it into an end
        const end =
          type === 'fs' || type === 'ff' || item.milestone ? at : endKeepingWork(cal, item, at)
        latestEnd = Math.min(latestEnd, end)
      }
    }
    const latestStart = item.milestone ? latestEnd : startKeepingWork(cal, item, latestEnd)
    late.set(item.task.id, { start: latestStart, end: latestEnd })
    if (workIn(cal, item.end, latestEnd, item.dateOnly) === 0) out.tasks.add(item.task.id)
  }

  for (const link of doc.links) {
    const from = graph.leavesOf(link.from)
    const to = graph.leavesOf(link.to)
    if (!from.some((item) => out.tasks.has(item.task.id))) continue
    // the link drives a critical task when that task sits right where the link allows
    const driven = to.some((item) => {
      if (!out.tasks.has(item.task.id)) return false
      const need = requirement(graph, link, item.dateOnly)
      const at = need.end ? item.end : item.start
      return notBefore(cal, need.at, at, item.dateOnly)
    })
    if (driven) out.links.add(link.id)
  }
  return out
}
