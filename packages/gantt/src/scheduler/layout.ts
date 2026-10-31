import { spanOf, type GanttData, type GanttTask, type TaskSpan } from '../core/model'

/** A row of the scheduler: a person, a room, a machine. */
export interface SchedulerResource<Data extends GanttData = GanttData> {
  id: string
  title: string
  /** Resources with the same group are listed together under its name. */
  group?: string
  /** How many tasks it can take at once; more than that shows as overloaded. Defaults to `1`. */
  capacity?: number
  /** Your own fields. */
  data?: Data
}

/** A task placed in its row. */
export interface SchedulerItem {
  task: GanttTask
  span: TaskSpan
  /** Which of the row's lanes it is drawn in, from `0`. */
  lane: number
}

/** A stretch of time with the same number of tasks going on. */
export interface SchedulerLoadSegment {
  start: number
  end: number
  count: number
}

/** A milestone takes no time; for packing, it holds a moment this long, in minutes. */
const POINT = 1

const endOf = (span: TaskSpan) => Math.max(span.end, span.start + POINT)

/**
 * Puts overlapping tasks in separate lanes: each task takes the first lane
 * that is free when it starts. Returns the lane count.
 */
export function packLanes(items: { span: TaskSpan; lane: number }[]) {
  const sorted = [...items]
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  sorted.sort((a, b) => a.span.start - b.span.start || endOf(b.span) - endOf(a.span))
  /** When each lane is free again. */
  const free: number[] = []
  for (const item of sorted) {
    let lane = free.findIndex((at) => at <= item.span.start)
    if (lane === -1) lane = free.length
    free[lane] = endOf(item.span)
    item.lane = lane
  }
  return free.length
}

/** How many tasks are going on over time; stretches with none are left out. */
export function loadSegments(spans: Iterable<TaskSpan>): SchedulerLoadSegment[] {
  const changes = new Map<number, number>()
  for (const span of spans) {
    // a milestone is not work
    if (span.end <= span.start) continue
    changes.set(span.start, (changes.get(span.start) ?? 0) + 1)
    changes.set(span.end, (changes.get(span.end) ?? 0) - 1)
  }
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  const times = [...changes.keys()].sort((a, b) => a - b)
  const out: SchedulerLoadSegment[] = []
  let count = 0
  for (let i = 0; i < times.length - 1; i++) {
    count += changes.get(times[i]!)!
    if (count <= 0) continue
    const last = out.at(-1)
    if (last && last.count === count && last.end === times[i]) last.end = times[i + 1]!
    else out.push({ start: times[i]!, end: times[i + 1]!, count })
  }
  return out
}

/**
 * The tasks of each resource, packed into lanes. Tasks without a resource,
 * or with one that isn't listed, go under `''`; tasks without dates are
 * left out.
 */
export function groupByResource(
  tasks: readonly GanttTask[],
  resources: readonly SchedulerResource[],
) {
  const known = new Set(resources.map((resource) => resource.id))
  const out = new Map<string, { items: SchedulerItem[]; lanes: number }>()
  for (const task of tasks) {
    const span = spanOf(task)
    if (!span) continue
    const key = task.resource && known.has(task.resource) ? task.resource : ''
    let entry = out.get(key)
    if (!entry) out.set(key, (entry = { items: [], lanes: 0 }))
    entry.items.push({ task, span, lane: 0 })
  }
  for (const entry of out.values()) entry.lanes = packLanes(entry.items)
  return out
}
