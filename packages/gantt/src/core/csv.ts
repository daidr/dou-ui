import type { GanttColumn } from '../types'
import { ganttLocales, format, type GanttMessages } from '../locale'
import { endKeepingWork, shiftWorkMinutes, shiftWorkdays, type WorkCalendar } from './calendar'
import { createId, spanOf, writeSpan, type GanttTask } from './model'
import { orderKeys } from './order'
import type { GanttTransaction } from './transaction'
import { buildTree } from './tree'
import { MINUTES_PER_DAY, MINUTES_PER_HOUR, parseTime } from './time'

/*
 * Reading tasks back from CSV, as `exportCSV` writes it: the columns are
 * found by their headers, dates are `YYYY-MM-DD` (or with `HH:mm`), the
 * duration is working days or hours and progress is 0–100.
 */

/** A value `parseCSV` couldn't read. */
export interface GanttCSVProblem {
  /** The row of the file it is on, the header being row 1. */
  row: number
  /** The column's `key`; `id` and `parent` for the columns `ids` adds. */
  column: string
  /** The text in the cell. */
  text: string
}

/** What `parseCSV` gives back. */
export interface GanttCSVResult {
  /** In the order of the file. */
  tasks: GanttTask[]
  /** Values that couldn't be read; their tasks come without them. */
  problems: GanttCSVProblem[]
  /**
   * The keys of the columns the file has, in its order; `id` and `parent`
   * for the columns `ids` adds.
   */
  columns: string[]
  /** Headers that are no column of the chart; their values are left out. */
  unknownColumns: string[]
}

/** How `importCSV` puts the tasks of a file into the chart. */
export interface GanttCSVImportOptions {
  /**
   * `replace` (the default): the file's tasks become the chart's. A task
   * whose id is already in the chart is updated with what the file has
   * and keeps the rest, links too; the tasks the file doesn't have are
   * removed. `append`: the file's tasks are added after the chart's, with
   * new ids where theirs are taken.
   */
  mode?: 'replace' | 'append'
}

/** Splits CSV into rows of fields (RFC 4180); a byte order mark at the start is dropped. */
export function splitCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const delimiter = delimiterOf(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let wasQuoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"' && field === '') {
      quoted = true
      wasQuoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
      wasQuoted = false
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      wasQuoted = false
    } else field += char
  }
  if (field !== '' || wasQuoted || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** `,`, or `;` or a tab when the header line has more of them, as files from some spreadsheets do. */
function delimiterOf(text: string) {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const char of text) {
    if (char === '"') quoted = !quoted
    else if (quoted) continue
    else if (char === '\n' || char === '\r') break
    else if (char in counts) counts[char]!++
  }
  let best = ','
  for (const delimiter of [';', '\t']) if (counts[delimiter]! > counts[best]!) best = delimiter
  return best
}

const BUILT_IN = ['title', 'start', 'end', 'duration', 'progress'] as const
const BUILT_IN_KEYS = new Set<string>([...BUILT_IN, 'id', 'parent'])

/** What a header can say for each column, in the chart's language and in the built-in ones. */
function headerNames(columns: GanttColumn[], messages: GanttMessages) {
  const names = new Map<string, string>()
  const add = (name: string | undefined, key: string) => {
    const text = name?.trim().toLowerCase()
    if (text && !names.has(text)) names.set(text, key)
  }
  const all = [messages, ...Object.values(ganttLocales)]
  for (const column of columns) {
    // a column of your own that only reads a value can't be written back
    if (column.value) continue
    const titles: (string | undefined)[] = [column.title]
    if (column.title == null && (BUILT_IN as readonly string[]).includes(column.key))
      for (const m of all) titles.push(m.columns[column.key as (typeof BUILT_IN)[number]])
    for (const title of titles) {
      add(title, column.key)
      if (column.key === 'duration' && title)
        for (const m of all) {
          add(format(m.daysColumn, { title }), 'duration:d')
          add(format(m.hoursColumn, { title }), 'duration:h')
        }
    }
    add(column.key, column.key)
  }
  for (const m of all) {
    add(m.idColumn, 'id')
    add(m.parentColumn, 'parent')
  }
  add('id', 'id')
  add('parent', 'parent')
  return names
}

/** A unit as a message writes it: `{count} 天` is `天`. */
const unitWord = (pattern: string) => format(pattern, { count: '' }).trim().toLowerCase()

/** A duration with its unit, when it says one: `5`, `5 天`, `2 小时`, `2h`. */
function readDuration(text: string, messages: GanttMessages) {
  const match = /^([+-]?\d+(?:\.\d+)?)\s*(.*)$/.exec(text.trim())
  if (!match) return null
  const count = Number(match[1])
  const unit = match[2]!.trim().toLowerCase()
  if (!unit) return { count, unit: null }
  const all = [messages, ...Object.values(ganttLocales)]
  if (unit === 'd' || all.some((m) => unitWord(m.days) === unit))
    return { count, unit: 'd' as const }
  if (unit === 'h' || all.some((m) => unitWord(m.hours) === unit))
    return { count, unit: 'h' as const }
  return null
}

export interface ParseCSVContext {
  columns: GanttColumn[]
  messages: GanttMessages
  calendar: WorkCalendar
}

/**
 * Reads the tasks of a CSV file. Throws when no header is the title
 * column, as the file then isn't a list of tasks.
 */
export function parseGanttCSV(text: string, context: ParseCSVContext): GanttCSVResult {
  const { columns, messages, calendar } = context
  const [head, ...lines] = splitCSV(text)
  const names = headerNames(columns, messages)
  const keys = (head ?? []).map((header) => names.get(header.trim().toLowerCase()))
  if (!keys.some((key) => key === 'title'))
    throw new Error(
      `[@dou-ui/gantt] parseCSV: no column of the file is the title column; its headers are ${JSON.stringify(head ?? [])}`,
    )
  const unknownColumns = (head ?? []).filter((header, i) => !keys[i] && header.trim())
  const byKey = new Map(columns.map((column) => [column.key, column]))
  // a task whose duration and end are both empty is a milestone, as exportCSV writes one
  const timing = keys.some((key) => key === 'end' || key?.startsWith('duration'))
  const problems: GanttCSVProblem[] = []
  const tasks: GanttTask[] = []
  const parents = new Map<GanttTask, { text: string; row: number }>()
  const ids = new Set<string>()

  lines.forEach((fields, index) => {
    const row = index + 2
    if (fields.every((field) => !field.trim())) return
    const cells = new Map<string, string>()
    keys.forEach((key, i) => {
      if (key && !cells.has(key)) cells.set(key, fields[i]?.trim() ?? '')
    })
    const problem = (column: string, value: string) => problems.push({ row, column, text: value })
    const task: GanttTask = { id: '', title: cells.get('title') ?? '' }

    const id = cells.get('id')
    if (id && ids.has(id)) problem('id', id)
    task.id = id && !ids.has(id) ? id : createId()
    ids.add(task.id)
    const parent = cells.get('parent')
    if (parent) parents.set(task, { text: parent, row })

    const startText = cells.get('start') ?? ''
    const start = startText ? parseTime(startText) : null
    if (startText && !start) problem('start', startText)
    if (start) {
      task.start = startText
      const endText = cells.get('end') ?? ''
      const durationKey = [...cells.keys()].find((key) => key.startsWith('duration'))
      const durationText = durationKey ? cells.get(durationKey)! : ''
      if (timing && !endText && !durationText) task.type = 'milestone'
      else {
        const unit = start.dateOnly ? MINUTES_PER_DAY : MINUTES_PER_HOUR
        let end: number | null = null
        if (endText) {
          const at = parseTime(endText)
          const to = at ? at.at + (at.dateOnly ? MINUTES_PER_DAY : 0) : null
          if (to != null && to > start.at) end = to
          else problem('end', endText)
        } else if (durationText) {
          const read = readDuration(durationText, messages)
          const hours = read?.unit
            ? read.unit === 'h'
            : durationKey === 'duration:h' || (durationKey !== 'duration:d' && !start.dateOnly)
          if (!read || !(read.count > 0)) problem('duration', durationText)
          else if (hours) end = shiftWorkMinutes(calendar, start.at, Math.round(read.count * 60))
          else end = shiftWorkdays(calendar, start.at, read.count)
        }
        Object.assign(task, writeSpan(task, start.at, end ?? start.at + unit))
      }
    }

    const progress = cells.get('progress')
    if (progress && task.type !== 'milestone') {
      const count = Number(progress.replace(/%$/, ''))
      if (Number.isFinite(count)) task.progress = Math.min(100, Math.max(0, count)) / 100
      else problem('progress', progress)
    }

    for (const [key, value] of cells) {
      if (key === 'id' || key === 'parent' || key.startsWith('duration')) continue
      if ((BUILT_IN as readonly string[]).includes(key) || !value) continue
      const column = byKey.get(key)!
      const next = column.parse ? column.parse(value, task) : value
      if (next === undefined) problem(key, value)
      else task.data = { ...task.data, [key]: next }
    }
    tasks.push(task)
  })

  // parents, once every id is known; a parent that is missing, or one of its own subtasks, is left out
  const byId = new Map(tasks.map((task) => [task.id, task]))
  for (const [task, { text: parent, row }] of parents) {
    let at = byId.get(parent)
    while (at && at !== task) at = at.parent ? byId.get(at.parent) : undefined
    if (byId.has(parent) && !at) task.parent = parent
    else problems.push({ row, column: 'parent', text: parent })
  }
  // a summary task's dates and progress come from its subtasks
  const summaries = new Set(tasks.map((task) => task.parent))
  for (const task of tasks)
    if (summaries.has(task.id)) {
      delete task.start
      delete task.end
      delete task.progress
      delete task.type
    }
  const found = [...new Set(keys.filter((key) => key != null))].map((key) =>
    key.startsWith('duration') ? 'duration' : key,
  )
  return { tasks, problems, columns: [...new Set(found)], unknownColumns }
}

/**
 * Puts the tasks `parseGanttCSV` read into a transaction, as
 * `GanttCSVImportOptions.mode` says.
 */
export function applyGanttCSV(
  tr: GanttTransaction,
  result: GanttCSVResult,
  mode: 'replace' | 'append',
  calendar: WorkCalendar,
) {
  if (mode === 'append') {
    // ids already in the chart are made new, and the subtasks follow
    const renamed = new Map<string, string>()
    for (const task of result.tasks) if (tr.getTask(task.id)) renamed.set(task.id, createId())
    for (const task of result.tasks)
      tr.addTask({
        ...task,
        id: renamed.get(task.id) ?? task.id,
        parent: task.parent != null ? (renamed.get(task.parent) ?? task.parent) : undefined,
      })
    return
  }

  const has = new Set(result.columns)
  const timed = has.has('end') || has.has('duration')
  const keep = new Set(result.tasks.map((task) => task.id))
  for (const task of result.tasks) {
    const old = tr.getTask(task.id)
    if (!old) {
      tr.addTask(task)
      continue
    }
    const patch: Partial<GanttTask> = { title: task.title }
    if (has.has('parent')) patch.parent = task.parent
    // a parent that is removed would take the task with it
    else if (old.parent != null && !keep.has(old.parent)) patch.parent = undefined
    if (has.has('progress')) patch.progress = task.progress
    if (has.has('start')) {
      const span = spanOf(old)
      const start = spanOf(task)
      if (timed || task.start == null || !span || !start || task.type !== old.type) {
        patch.start = task.start
        patch.end = task.end
        patch.type = task.type
      } else if (old.type === 'milestone') patch.start = task.start
      // without an end or a duration in the file, the task moves and keeps its work
      else
        Object.assign(
          patch,
          writeSpan(old, start.start, endKeepingWork(calendar, span, start.start)),
        )
    }
    const own = [...has].filter((key) => !BUILT_IN_KEYS.has(key))
    if (own.length) {
      const data = { ...old.data }
      for (const key of own) {
        if (task.data?.[key] === undefined) delete data[key]
        else data[key] = task.data[key]
      }
      patch.data = Object.keys(data).length ? data : undefined
    }
    tr.updateTask(task.id, patch)
  }
  for (const task of tr.doc.tasks.slice())
    if (!keep.has(task.id) && tr.getTask(task.id)) tr.removeTask(task.id)

  // siblings in the order of the file: new order keys where the chart has them otherwise
  const tree = buildTree(tr.doc.tasks)
  const wanted = new Map<string | undefined, string[]>()
  for (const task of result.tasks) {
    const parent = tr.getTask(task.id)?.parent
    const list = wanted.get(parent)
    if (list) list.push(task.id)
    else wanted.set(parent, [task.id])
  }
  for (const [parent, ids] of wanted) {
    const now = (tree.childrenOf.get(parent) ?? []).map((task) => task.id)
    if (now.join('\n') === ids.join('\n')) continue
    const keys = orderKeys(ids.length)
    ids.forEach((id, i) => tr.updateTask(id, { order: keys[i] }))
  }
}
