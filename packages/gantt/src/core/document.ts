import { resolveGanttExtensions, type GanttExtension } from './extension'
import { linkRefusal, parseLag } from './links'
import type { GanttLink, GanttTask } from './model'
import { parseTime } from './time'
import type { GanttDocument } from './transaction'

export interface DocumentProblem {
  code:
    | 'version'
    | 'shape'
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
    | 'refused-link'
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
 * What is wrong with the shape itself: the document is not an object, or a
 * list in it is not an array. Nothing else can be checked until it is fixed.
 */
function shapeProblems(value: unknown, lists: string[]): DocumentProblem[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return [{ code: 'shape', path: '', text: '', message: 'The document is not an object' }]
  return lists
    .filter((key) => !Array.isArray((value as Record<string, unknown>)[key]))
    .map((key) => ({ code: 'shape', path: key, text: '', message: `"${key}" is not a list` }))
}

export interface CheckDocumentOptions {
  /** The chart's `canLink`, to check the links against it too. */
  canLink?: GanttRule
  /** The chart's extensions, to check the links against their `canLink` too. */
  extensions?: readonly (GanttExtension | readonly GanttExtension[])[]
}

type GanttRule = NonNullable<GanttExtension['canLink']>

/**
 * The problems of a Gantt document, before it is saved or shown: an
 * unknown version, tasks and links without an id or sharing one, `parent`
 * pointing nowhere or in a circle, dates and lags that can't be read, and
 * links to missing tasks, to the task itself, between a summary and its
 * own task, twice between the same tasks, or in a circle; with `canLink`
 * or `extensions`, links their rules refuse too.
 */
export function checkDocument(
  document: GanttDocument,
  options: CheckDocumentOptions = {},
): DocumentProblem[] {
  const shape = shapeProblems(document, ['tasks', 'links'])
  if (shape.length) return shape
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
    // only the members of a circle are reported; one hanging below it is fine itself
    const seen = new Set<string>()
    for (let at = tasks.get(task.parent); at; at = at.parent ? tasks.get(at.parent) : undefined) {
      if (at.id !== task.id) {
        if (seen.has(at.id)) break
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

  const rules: GanttRule[] = [
    ...(options.canLink ? [options.canLink] : []),
    ...(options.extensions ? resolveGanttExtensions(options.extensions).linkRules : []),
  ]
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
      for (const rule of rules) {
        const answer = rule(link, document)
        if (answer === true) continue
        problems.push({
          code: 'refused-link',
          linkId: link.id,
          path,
          text: typeof answer === 'string' ? answer : '',
          message: `The link "${link.id}" is refused by a canLink rule${typeof answer === 'string' && answer ? `: ${answer}` : ''}`,
        })
        break
      }
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

/** The saved data as an object of version 1, or an error saying why it can't be. */
function sourceOf(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error(
      `[@dou-ui/gantt] a Gantt document must be an object, not ${Array.isArray(input) ? 'an array' : (JSON.stringify(input) ?? String(input))}`,
    )
  const source = input as Record<string, unknown>
  const version = source.version ?? 1
  if (version !== 1)
    throw new Error(
      `[@dou-ui/gantt] unknown document version ${JSON.stringify(version) ?? String(version)} (expected 1); data saved by a newer @dou-ui/gantt needs that version to open`,
    )
  return source
}

/**
 * Brings a saved document up to the current version, and fills what an
 * older or hand-written one may lack (`version`, `tasks`, `links`). Tasks
 * and links that are not objects are dropped; anything else is kept as it
 * is. Throws for data that is not an object
 * (an array, `null`, a string) and for a version it does not know.
 */
export function migrateDocument(input: unknown): GanttDocument {
  const source = sourceOf(input)
  return {
    ...source,
    version: 1,
    tasks: objects<GanttTask>(source.tasks),
    links: objects<GanttLink>(source.links),
  }
}

const warned = new Set<string>()

/**
 * The `v-model` as the chart reads it. A document of the wrong shape (not an
 * object, without `tasks` or `links`, without a known `version`) gets a
 * warning in development and is read with what is missing left empty and the
 * version as 1, so the chart still opens and what it writes back carries
 * `version: 1`. The scheduler doesn't use `links` and doesn't need them.
 */
export function readDocument(value: unknown, needsLinks = true): GanttDocument {
  const plain = !!value && typeof value === 'object' && !Array.isArray(value)
  const source = (plain ? value : {}) as Partial<GanttDocument>
  const tasks = Array.isArray(source.tasks)
  const links = Array.isArray(source.links)
  const problem = !plain
    ? `is ${Array.isArray(value) ? 'an array' : (JSON.stringify(value) ?? String(value))}`
    : !tasks
      ? 'has no tasks array'
      : !links && needsLinks
        ? 'has no links array'
        : source.version === undefined
          ? 'has no version'
          : source.version !== 1
            ? `has version ${JSON.stringify(source.version)}`
            : ''
  if (!problem && links) return value as GanttDocument
  if (problem && process.env.NODE_ENV !== 'production' && !warned.has(problem)) {
    warned.add(problem)
    console.warn(
      `[@dou-ui/gantt] the v-model ${problem}; expected { version: 1, tasks: [...], links: [...] }. What is missing is read as empty and the version as 1; read saved data with migrateDocument().`,
    )
  }
  return {
    ...source,
    version: 1,
    tasks: tasks ? source.tasks! : [],
    links: links ? source.links! : [],
  }
}
