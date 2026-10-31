import { writeSpan, type GanttLink, type GanttTask } from './model'
import { MINUTES_PER_DAY, parseTime } from './time'

/*
 * Every change to the tasks and links is a list of steps. Applying a step
 * also gives the step that undoes it, so history, collaboration and the
 * `transaction` event all work on the same small vocabulary.
 */

type Patch<T> = { [K in keyof T]?: T[K] | undefined }

/** The tasks and links together, as a transaction sees them. */
export interface GanttDocument {
  tasks: GanttTask[]
  links: GanttLink[]
}

export type GanttStep =
  | { type: 'addTask'; task: GanttTask; index?: number }
  | { type: 'removeTask'; id: string }
  | { type: 'updateTask'; id: string; patch: Patch<GanttTask> }
  | { type: 'addLink'; link: GanttLink; index?: number }
  | { type: 'removeLink'; id: string }
  | { type: 'updateLink'; id: string; patch: Patch<GanttLink> }

export interface GanttTransactionMeta {
  /** Keep out of the undo history, e.g. folding a summary or a change from another client. */
  history?: boolean
  /**
   * Consecutive transactions in the same group within a second undo as
   * one, e.g. repeated arrow key nudges.
   */
  group?: string
  /**
   * With `scheduling="auto"`, set to `false` to leave the waiting tasks
   * where they are, e.g. for a change from another client.
   */
  schedule?: boolean
  /** Who made the change, passed on to the `transaction` event. */
  origin?: string
}

function patched<T extends object>(item: T, patch: Patch<T>): T {
  const next = { ...item } as Record<string, unknown>
  for (const key of Object.keys(patch)) {
    const value = (patch as Record<string, unknown>)[key]
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  return next as T
}

/** The values `patch` would replace, so applying them restores `item`. */
function previous<T extends object>(item: T, patch: Patch<T>): Patch<T> {
  const old: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) old[key] = (item as Record<string, unknown>)[key]
  return old as Patch<T>
}

/** A time as minutes; a date-only end counts its whole day. */
function minutesOf(time: number | string, end: boolean) {
  if (typeof time === 'number') return time
  const parsed = parseTime(time)
  if (!parsed) throw new RangeError(`Can't read the time "${time}"`)
  return parsed.at + (end && parsed.dateOnly ? MINUTES_PER_DAY : 0)
}

const clampIndex = (index: number | undefined, length: number) =>
  index == null ? length : Math.max(0, Math.min(length, index))

/**
 * A batch of changes. Steps apply as they are added, so later calls see
 * earlier ones; `doc` is the result.
 */
export class GanttTransaction {
  readonly steps: GanttStep[] = []
  /** The steps that undo this transaction, in the order to apply them. */
  readonly inverse: GanttStep[] = []
  meta: GanttTransactionMeta = {}
  private tasks: GanttTask[]
  private links: GanttLink[]
  private copied = { tasks: false, links: false }

  constructor(readonly before: GanttDocument) {
    this.tasks = before.tasks
    this.links = before.links
  }

  get doc(): GanttDocument {
    if (!this.steps.length) return this.before
    return { tasks: this.tasks, links: this.links }
  }

  get changed() {
    return this.steps.length > 0
  }

  /** Whether the tasks, or the links, changed. */
  touches(kind: 'tasks' | 'links') {
    return this.copied[kind]
  }

  getTask(id: string) {
    return this.tasks.find((task) => task.id === id)
  }

  getLink(id: string) {
    return this.links.find((link) => link.id === id)
  }

  /** Links into or out of a task. */
  linksOf(id: string) {
    return this.links.filter((link) => link.from === id || link.to === id)
  }

  setMeta(meta: GanttTransactionMeta) {
    Object.assign(this.meta, meta)
    return this
  }

  step(step: GanttStep) {
    const inverse = this.apply(step)
    if (inverse) {
      this.steps.push(step)
      this.inverse.unshift(inverse)
    }
    return this
  }

  addTask(task: GanttTask, index?: number) {
    return this.step({ type: 'addTask', task, index })
  }

  /** Removes a task with its subtasks and every link attached to them. */
  removeTask(id: string) {
    for (const child of this.tasks.filter((task) => task.parent === id)) this.removeTask(child.id)
    for (const link of this.linksOf(id)) this.removeLink(link.id)
    return this.step({ type: 'removeTask', id })
  }

  updateTask(id: string, patch: Patch<GanttTask>) {
    return this.step({ type: 'updateTask', id, patch })
  }

  /**
   * Sets a task's dates, written back in the task's own style. Takes
   * minutes, or strings read like the task's own: a date-only `end` is the
   * last day of the task.
   */
  setSpan(id: string, start: number | string, end: number | string) {
    const task = this.getTask(id)
    if (!task) return this
    return this.updateTask(id, writeSpan(task, minutesOf(start, false), minutesOf(end, true)))
  }

  /** Merges `patch` into the task's `data`. */
  updateData(id: string, patch: Record<string, unknown>) {
    const task = this.getTask(id)
    if (!task) return this
    return this.updateTask(id, { data: { ...task.data, ...patch } })
  }

  addLink(link: GanttLink, index?: number) {
    return this.step({ type: 'addLink', link, index })
  }

  removeLink(id: string) {
    return this.step({ type: 'removeLink', id })
  }

  updateLink(id: string, patch: Patch<GanttLink>) {
    return this.step({ type: 'updateLink', id, patch })
  }

  private writable<K extends 'tasks' | 'links'>(kind: K): GanttDocument[K] {
    if (!this.copied[kind]) {
      this.copied[kind] = true
      if (kind === 'tasks') this.tasks = this.tasks.slice()
      else this.links = this.links.slice()
    }
    return (kind === 'tasks' ? this.tasks : this.links) as GanttDocument[K]
  }

  /** Applies a step and returns its inverse, or `null` when it changes nothing. */
  private apply(step: GanttStep): GanttStep | null {
    switch (step.type) {
      case 'addTask': {
        if (this.getTask(step.task.id)) return null
        const list = this.writable('tasks')
        list.splice(clampIndex(step.index, list.length), 0, step.task)
        return { type: 'removeTask', id: step.task.id }
      }
      case 'removeTask': {
        const index = this.tasks.findIndex((task) => task.id === step.id)
        if (index < 0) return null
        const [task] = this.writable('tasks').splice(index, 1)
        return { type: 'addTask', task: task!, index }
      }
      case 'updateTask': {
        const index = this.tasks.findIndex((task) => task.id === step.id)
        if (index < 0) return null
        const task = this.tasks[index]!
        const keys = Object.keys(step.patch) as (keyof GanttTask)[]
        if (keys.every((key) => task[key] === step.patch[key])) return null
        this.writable('tasks')[index] = patched(task, step.patch)
        return { type: 'updateTask', id: step.id, patch: previous(task, step.patch) }
      }
      case 'addLink': {
        if (this.getLink(step.link.id)) return null
        const list = this.writable('links')
        list.splice(clampIndex(step.index, list.length), 0, step.link)
        return { type: 'removeLink', id: step.link.id }
      }
      case 'removeLink': {
        const index = this.links.findIndex((link) => link.id === step.id)
        if (index < 0) return null
        const [link] = this.writable('links').splice(index, 1)
        return { type: 'addLink', link: link!, index }
      }
      case 'updateLink': {
        const index = this.links.findIndex((link) => link.id === step.id)
        if (index < 0) return null
        const link = this.links[index]!
        const keys = Object.keys(step.patch) as (keyof GanttLink)[]
        if (keys.every((key) => link[key] === step.patch[key])) return null
        this.writable('links')[index] = patched(link, step.patch)
        return { type: 'updateLink', id: step.id, patch: previous(link, step.patch) }
      }
    }
  }
}

/** Applies steps to a document; steps that no longer apply are skipped. */
export function applyGanttSteps(doc: GanttDocument, steps: readonly GanttStep[]) {
  const tr = new GanttTransaction(doc)
  for (const step of steps) tr.step(step)
  return tr
}

const targetOf = (step: GanttStep) => {
  switch (step.type) {
    case 'addTask':
      return `t:${step.task.id}`
    case 'addLink':
      return `l:${step.link.id}`
    case 'removeTask':
    case 'updateTask':
      return `t:${step.id}`
    case 'removeLink':
    case 'updateLink':
      return `l:${step.id}`
  }
}

/**
 * Folds updates of the same task or link into one, as long as nothing
 * adds or removes it in between.
 */
export function compactSteps(steps: readonly GanttStep[]): GanttStep[] {
  const out: GanttStep[] = []
  const lastUpdate = new Map<string, number>()
  for (const step of steps) {
    const target = targetOf(step)
    if (step.type === 'updateTask' || step.type === 'updateLink') {
      const at = lastUpdate.get(target)
      if (at != null) {
        const prev = out[at] as typeof step
        out[at] = { ...prev, patch: { ...prev.patch, ...step.patch } } as GanttStep
        continue
      }
      lastUpdate.set(target, out.length)
    } else {
      lastUpdate.delete(target)
    }
    out.push(step)
  }
  return out
}
