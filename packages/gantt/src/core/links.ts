import type { GanttLink, GanttLinkType, GanttTask } from './model'

/** Why a new link was refused. */
export type GanttLinkRefusal = 'self' | 'nested' | 'duplicate' | 'cycle' | 'custom'

/** Whether `to` can be reached from `from` along the links. */
export function reaches(links: readonly GanttLink[], from: string, to: string) {
  const next = new Map<string, string[]>()
  for (const link of links) {
    const list = next.get(link.from)
    if (list) list.push(link.to)
    else next.set(link.from, [link.to])
  }
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length) {
    const id = stack.pop()!
    if (id === to) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(next.get(id) ?? []))
  }
  return false
}

/** Whether `ancestor` is a parent, grandparent… of `id`. */
function isAncestor(tasks: ReadonlyMap<string, GanttTask>, ancestor: string, id: string) {
  const seen = new Set<string>()
  for (let up = tasks.get(id)?.parent; up != null && !seen.has(up); up = tasks.get(up)?.parent) {
    if (up === ancestor) return true
    seen.add(up)
  }
  return false
}

/**
 * Why a link from `from` to `to` can't be made, or `null` when it can: a
 * task can't depend on itself, on its own parent or child, on a task it
 * already depends on, or on a task that waits for it.
 */
export function linkRefusal(
  tasks: ReadonlyMap<string, GanttTask>,
  links: readonly GanttLink[],
  from: string,
  to: string,
): GanttLinkRefusal | null {
  if (from === to) return 'self'
  if (isAncestor(tasks, from, to) || isAncestor(tasks, to, from)) return 'nested'
  if (
    links.some(
      (link) => (link.from === from && link.to === to) || (link.from === to && link.to === from),
    )
  )
    return 'duplicate'
  if (reaches(links, to, from)) return 'cycle'
  return null
}

/** The link type for a line drawn from one end of a task to one end of another. */
export function linkTypeOf(fromEnd: 'start' | 'end', toEnd: 'start' | 'end'): GanttLinkType {
  if (fromEnd === 'end') return toEnd === 'start' ? 'fs' : 'ff'
  return toEnd === 'start' ? 'ss' : 'sf'
}

/** A link's lag, read: an amount of working days, or of working minutes. */
export interface GanttLag {
  amount: number
  unit: 'day' | 'minute'
}

/** Reads a `lag`: a number of working days, or `'2d'`, `'4h'`, `'30m'`; `null` when unreadable. */
export function parseLag(lag: number | string | undefined): GanttLag | null {
  if (lag == null || lag === '') return { amount: 0, unit: 'day' }
  if (typeof lag === 'number') return Number.isFinite(lag) ? { amount: lag, unit: 'day' } : null
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*(d|h|m)\s*$/i.exec(lag)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2]!.toLowerCase()
  if (unit === 'd') return { amount: value, unit: 'day' }
  return { amount: Math.round(unit === 'h' ? value * 60 : value), unit: 'minute' }
}
