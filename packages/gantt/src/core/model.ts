import type { Tone } from 'dou-ui'
import { MINUTES_PER_DAY, MINUTES_PER_HOUR, formatTime, isMidnight, parseTime } from './time'

export type GanttData = Record<string, unknown>

export interface GanttTask<Data extends GanttData = GanttData> {
  id: string
  title: string
  /** The parent task's id. A task with children is a summary task. */
  parent?: string
  /**
   * Sort key among siblings, compared as a string. Siblings without one
   * keep their order in the array.
   */
  order?: string
  /** A milestone is a point in time: it only reads `start`. */
  type?: 'task' | 'milestone'
  /** `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`. Without it the task is not scheduled yet. */
  start?: string
  /**
   * `YYYY-MM-DD` for the last day of the task, or `YYYY-MM-DD HH:mm` for the
   * moment it ends. Defaults to one day, or one hour after a timed `start`.
   */
  end?: string
  /** From `0` to `1`. */
  progress?: number
  tone?: Tone
  /** Hide the children. */
  collapsed?: boolean
  /** Can't be moved or resized. */
  locked?: boolean
  /** Your own fields, e.g. for columns. */
  data?: Data
}

export type GanttLinkType = 'fs' | 'ss' | 'ff' | 'sf'

/** A dependency: `to` waits for `from`. */
export interface GanttLink {
  id: string
  from: string
  to: string
  /**
   * `fs` finish to start (the default): `to` starts after `from` finishes;
   * `ss` start to start; `ff` finish to finish; `sf` start to finish.
   */
  type?: GanttLinkType
  /** Working days between the two ends; may be negative. */
  lag?: number
}

/** Where a task sits in time, in minutes since the epoch. `end` is exclusive. */
export interface TaskSpan {
  start: number
  end: number
  /** Both ends are whole days, written without a time. */
  dateOnly: boolean
}

/**
 * Reads a task's dates. A date-only `end` covers its whole day; a missing or
 * early one makes the task one day (or one hour) long. A milestone's span
 * is empty: `start` and `end` are the same moment, the middle of its day
 * when it has no time.
 */
export function spanOf(task: GanttTask): TaskSpan | null {
  const start = parseTime(task.start)
  if (!start) return null
  if (task.type === 'milestone') {
    const at = start.dateOnly ? start.at + MINUTES_PER_DAY / 2 : start.at
    return { start: at, end: at, dateOnly: start.dateOnly }
  }
  const end = parseTime(task.end)
  const dateOnly = start.dateOnly && (!end || end.dateOnly)
  const unit = dateOnly ? MINUTES_PER_DAY : MINUTES_PER_HOUR
  let to = end ? (end.dateOnly ? end.at + MINUTES_PER_DAY : end.at) : start.at + unit
  if (to <= start.at) to = start.at + unit
  return { start: start.at, end: to, dateOnly }
}

/**
 * The `start` and `end` strings for a span, in the task's own style: whole
 * days stay date-only, anything else is written with times.
 */
export function writeSpan(
  task: GanttTask,
  start: number,
  end: number,
): Pick<GanttTask, 'start' | 'end'> {
  const was = spanOf(task)
  const wholeDays = isMidnight(start) && isMidnight(end) && end > start
  if (task.type === 'milestone') {
    const dateOnly = (was?.dateOnly ?? true) && isMidnight(start - MINUTES_PER_DAY / 2)
    return {
      start: dateOnly ? formatTime(start - MINUTES_PER_DAY / 2, true) : formatTime(start),
    }
  }
  if ((was?.dateOnly ?? true) && wholeDays)
    return { start: formatTime(start, true), end: formatTime(end - MINUTES_PER_DAY, true) }
  return { start: formatTime(start), end: formatTime(end) }
}

export const clampProgress = (value: number | undefined) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value! : 0))

export const createId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
