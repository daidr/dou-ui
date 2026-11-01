import { linkRefusal, parseLag } from './links'
import type { GanttLink, GanttTask } from './model'
import { parseTime } from './time'
import type { GanttDocument } from './transaction'

export interface DocumentProblem {
  code:
    | 'version'
    | 'missing-id'
    | 'duplicate-id'
    | 'missing-parent'
    | 'parent-cycle'
    | 'bad-date'
    | 'missing-task'
    | 'bad-lag'
    | 'self-link'
    | 'nested-link'
    | 'duplicate-link'
    | 'link-cycle'
  /** The task at fault, or the task a link points at. */
  taskId?: string
  /** The link at fault. */
  linkId?: string
  /**
   * Where the problem is, as a path into the document, e.g. `tasks[2].start`
   * or `links[0].to`; `version` for the version.
   */
  path: string
  /** The id, date or lag at fault, for the editor's message. */
  text: string
  /** An English description, for logs. */
  message: string
}

/**
 * The problems of a Gantt document, before it is saved or shown: an
 * unknown version, tasks and links without an id or sharing one, `parent`
 * pointing nowhere or in a circle, dates and lags that can't be read, and
 * links to missing tasks, to the task itself, between a summary and its
 * own task, twice between the same tasks, or in a circle.
 */
export function checkDocument(document: GanttDocument): DocumentProblem[] {
  const problems: DocumentProblem[] = []
  if (document.version !== 1)
    problems.push({
      code: 'version',
      path: 'version',
      text: String(document.version),
      message: `Version ${String(document.version)} is not known`,
    })

  const tasks = new Map<string, GanttTask>()
  document.tasks.forEach((task, i) => {
    const path = `tasks[${i}]`
    if (!task.id) {
      problems.push({ code: 'missing-id', path, text: '', message: `${path} has no id` })
      return
    }
    if (tasks.has(task.id))
      problems.push({
        code: 'duplicate-id',
        taskId: task.id,
        path,
        text: task.id,
        message: `The task id "${task.id}" is used more than once`,
      })
    else tasks.set(task.id, task)
    for (const key of ['start', 'end'] as const) {
      const text = task[key]
      if (text == null || text === '' || parseTime(text)) continue
      problems.push({
        code: 'bad-date',
        taskId: task.id,
        path: `${path}.${key}`,
        text: String(text),
        message: `The ${key} "${String(text)}" of "${task.id}" is not a date`,
      })
    }
  })

  document.tasks.forEach((task, i) => {
    if (!task.id || !task.parent || tasks.get(task.id) !== task) return
    const path = `tasks[${i}].parent`
    if (!tasks.has(task.parent)) {
      problems.push({
        code: 'missing-parent',
        taskId: task.id,
        path,
        text: task.parent,
        message: `The parent "${task.parent}" of "${task.id}" is not in the document`,
      })
      return
    }
    const seen = new Set([task.id])
    for (let at = tasks.get(task.parent); at; at = at.parent ? tasks.get(at.parent) : undefined) {
      if (!seen.has(at.id)) {
        seen.add(at.id)
        continue
      }
      problems.push({
        code: 'parent-cycle',
        taskId: task.id,
        path,
        text: task.parent,
        message: `The task "${task.id}" is inside itself through its parents`,
      })
      break
    }
  })

  const ids = new Set<string>()
  /** The links before this one that join tasks that are there, for the rules between links. */
  const sound: GanttLink[] = []
  document.links.forEach((link, i) => {
    const path = `links[${i}]`
    if (!link.id)
      problems.push({ code: 'missing-id', path, text: '', message: `${path} has no id` })
    else if (ids.has(link.id))
      problems.push({
        code: 'duplicate-id',
        linkId: link.id,
        path,
        text: link.id,
        message: `The link id "${link.id}" is used more than once`,
      })
    ids.add(link.id)
    if (!parseLag(link.lag))
      problems.push({
        code: 'bad-lag',
        linkId: link.id,
        path: `${path}.lag`,
        text: String(link.lag),
        message: `The lag "${String(link.lag)}" of "${link.id}" can't be read`,
      })
    let missing = false
    for (const end of ['from', 'to'] as const) {
      if (tasks.has(link[end])) continue
      missing = true
      problems.push({
        code: 'missing-task',
        linkId: link.id,
        taskId: link[end] || undefined,
        path: `${path}.${end}`,
        text: String(link[end] ?? ''),
        message: `The task "${String(link[end])}" the link "${link.id}" points at is not in the document`,
      })
    }
    if (missing) return
    const refusal = linkRefusal(tasks, sound, link.from, link.to)
    if (!refusal) {
      sound.push(link)
      return
    }
    problems.push({
      code: LINK_PROBLEMS[refusal as keyof typeof LINK_PROBLEMS][0],
      linkId: link.id,
      path,
      text: link.id,
      message: LINK_PROBLEMS[refusal as keyof typeof LINK_PROBLEMS][1](link),
    })
  })
  return problems
}

/** What each refusal of `linkRefusal` is as a problem; `custom` can't come without rules. */
const LINK_PROBLEMS = {
  self: ['self-link', (link: GanttLink) => `The link "${link.id}" joins "${link.from}" to itself`],
  nested: [
    'nested-link',
    (link: GanttLink) =>
      `The link "${link.id}" joins a summary task and a task inside it ("${link.from}", "${link.to}")`,
  ],
  duplicate: [
    'duplicate-link',
    (link: GanttLink) =>
      `The link "${link.id}" joins "${link.from}" and "${link.to}", which another link already joins`,
  ],
  cycle: [
    'link-cycle',
    (link: GanttLink) =>
      `The link "${link.id}" from "${link.from}" to "${link.to}" closes a circle of links`,
  ],
} as const satisfies Record<string, readonly [DocumentProblem['code'], (link: GanttLink) => string]>

const objects = <T>(value: unknown) =>
  (Array.isArray(value) ? value : []).filter(
    (item): item is T => !!item && typeof item === 'object',
  )

/**
 * Brings a saved document up to the current version, and fills what an
 * older or hand-written one may lack (`version`, `tasks`, `links`). Tasks
 * and links that are not objects are dropped; anything else is kept as it
 * is. Throws for a version newer than this one knows.
 */
export function migrateDocument(input: unknown): GanttDocument {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const version = source.version ?? 1
  if (version !== 1) throw new Error(`Gantt version ${String(version)} is not known`)
  return {
    ...source,
    version: 1,
    tasks: objects<GanttTask>(source.tasks),
    links: objects<GanttLink>(source.links),
  }
}
