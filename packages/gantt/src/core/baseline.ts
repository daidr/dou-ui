import { spanOf, type GanttTask, type TaskSpan } from './model'
import { MINUTES_PER_DAY, dayStart, formatTime } from './time'
import { buildTree } from './tree'

/** A task's dates as planned, to compare the current ones with. */
export interface GanttBaselineItem {
  id: string
  start: string
  end?: string
}

/**
 * Saves the current dates of every task as a baseline, summaries included
 * (with the dates their children cover). Tasks without dates are left out.
 */
export function takeBaseline(tasks: readonly GanttTask[]): GanttBaselineItem[] {
  const out: GanttBaselineItem[] = []
  for (const [id, row] of buildTree(tasks).byId) {
    if (!row.span) continue
    const { start, end, dateOnly } = row.span
    if (row.milestone)
      out.push({
        id,
        start: dateOnly ? formatTime(start - MINUTES_PER_DAY / 2, true) : formatTime(start),
      })
    else if (dateOnly)
      // a summary ending on a milestone ends at noon, on its day
      out.push({ id, start: formatTime(start, true), end: formatTime(dayStart(end - 1), true) })
    else out.push({ id, start: formatTime(start), end: formatTime(end) })
  }
  return out
}

/** The planned span of each task in a baseline, read as the task's own dates are. */
export function baselineSpans(
  baseline: readonly GanttBaselineItem[],
  milestones: (id: string) => boolean,
): Map<string, TaskSpan> {
  const out = new Map<string, TaskSpan>()
  for (const item of baseline) {
    const span = spanOf({
      id: item.id,
      title: '',
      type: milestones(item.id) ? 'milestone' : undefined,
      start: item.start,
      end: item.end,
    })
    if (span) out.set(item.id, span)
  }
  return out
}
