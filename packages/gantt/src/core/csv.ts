import type { GanttColumn } from '../types'
import { ganttLocales, format, type GanttMessages } from '../locale'
import { endKeepingWork, shiftWorkMinutes, shiftWorkdays, type WorkCalendar } from './calendar'
import { createId, spanOf, writeSpan, type GanttTask } from './model'
import { orderKeys } from './order'
import type { GanttTransaction } from './transaction'
import { buildTree } from './tree'
import { MINUTES_PER_DAY, MINUTES_PER_HOUR, parseTime } from './time'

/*
 * Reading tasks back from CSV, as `toCSV` writes it: the columns are
 * found by their headers, dates are `YYYY-MM-DD` (or with `HH:mm`), the
 * duration is working days or hours and progress is 0–100.
 */

/** A value `readCSV` couldn't read; the task keeps what it had, or goes without it. */
export interface GanttCSVWarning {
  /** The row of the file it is on, the header being row 1. */
  row: number
  /** The column's `key`; `id` and `parent` for the columns `ids` adds. */
  column: string
  /** The text in the cell. */
  text: string
}

/** What `readCSV` and `importCSV` give back. */
export interface GanttCSVResult {
  /** In the order of the file. */
  tasks: GanttTask[]
  /** Values that couldn't be read. */
  warnings: GanttCSVWarning[]
  /**
   * The keys of the columns the file has, in its order; `id` and `parent`
   * for the columns `ids` adds.
   */
  columns: string[]
  /** Headers that are no field and no column of the chart; their values are left out. */
  unknownColumns: string[]
}

/** Why a file can't be read as tasks, as the `code` of a `GanttCSVError`. */
export type GanttCSVErrorCode = 'noTitleColumn'

/** Thrown when a file can't be read as tasks: for developers in `message`, for people in `reason`. */
export class GanttCSVError extends Error {
  override name = 'GanttCSVError'
  constructor(
    message: string,
    readonly code: GanttCSVErrorCode,
    readonly reason: string,
  ) {
    super(message)
  }
}

/** What couldn't be read of each task, for `importCSV` to keep the chart's values. */
const unreadOf = new WeakMap<GanttTask, Set<string>>()

/** How `importCSV` puts the tasks of a file into the chart. */
export interface GanttCSVImportOptions {
  /**
   * `replace` (the default): the file's tasks become the chart's. A task
   * whose id is already in the chart is updated with what the file has
   * and keeps the rest, links too; the tasks the file doesn't have are
   * removed. It is the default as the usual way back is the file the
   * chart wrote, edited in a spreadsheet. `append`: the file's tasks are
   * added after the chart's, with new ids where theirs are taken.
   */
  mode?: 'replace' | 'append'
}

/**
 * Splits CSV into rows of fields (RFC 4180); a byte order mark at the start
 * is dropped. `delimiter` defaults to the one the text most likely uses.
 */
export function splitCSV(text: string, delimiter = delimiterOf(text)): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
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

const DELIMITERS = [',', ';', '\t', '|'] as const

/**
 * The delimiter a text most likely uses: of `,`, `;`, tab and `|`, the one
 * found most often outside quotes in its first lines, and the same number
 * of times on each; a comma when none is found. Kept in step with
 * `detectDelimiter` of `@dou-ui/sheet`, so a file reads the same in both.
 */
function delimiterOf(text: string) {
  const counts = new Map<string, number[]>(DELIMITERS.map((d) => [d, [0]]))
  let quoted = false
  let lines = 0
  for (let i = 0; i < text.length && lines < 10; i++) {
    const char = text[i]!
    if (char === '"') quoted = !quoted
    else if (quoted) continue
    else if (char === '\n') {
      lines++
      for (const line of counts.values()) line.push(0)
    } else {
      const line = counts.get(char)
      if (line) line[line.length - 1]!++
    }
  }
  let best: string = ','
  let score = 0
  for (const [delimiter, perLine] of counts) {
    // a last line cut short or left empty doesn't count
    const full =
      perLine.length > 1 && perLine[perLine.length - 1] === 0 ? perLine.slice(0, -1) : perLine
    const first = full[0] ?? 0
    if (!first) continue
    const value = first * (full.every((n) => n === first) ? 2 : 1)
    if (value > score) {
      score = value
      best = delimiter
    }
  }
  return best
}

const BUILT_IN = ['title', 'start', 'end', 'duration', 'progress'] as const
const BUILT_IN_KEYS = new Set<string>([...BUILT_IN, 'id', 'parent'])
/** A column the chart has that only reads a value: known, but not read. */
const SKIP = '\0skip'

/**
 * What a header can say for each column: the built-in fields always, in
 * the chart's language and in the built-in ones, whatever `columns` shows;
 * the chart's own columns by their titles.
 */
function headerNames(columns: GanttColumn[], messages: GanttMessages) {
  const names = new Map<string, string>()
  const add = (name: string | undefined, key: string) => {
    const text = name?.trim().toLowerCase()
    if (text && !names.has(text)) names.set(text, key)
  }
  const all = [messages, ...Object.values(ganttLocales)]
  const titles = (key: string, own?: string) => {
    const list = own != null ? [own] : []
    if ((BUILT_IN as readonly string[]).includes(key))
      for (const m of all) list.push(m.columns[key as (typeof BUILT_IN)[number]])
    return list
  }
  const addColumn = (key: string, own?: string) => {
    for (const title of titles(key, own)) {
      add(title, key)
      if (key === 'duration')
        for (const m of all) {
          add(format(m.daysColumn, { title }), 'duration:d')
          add(format(m.hoursColumn, { title }), 'duration:h')
        }
    }
    add(key, key)
  }
  // a column of your own that only reads a value can't be written back
  for (const column of columns) if (column.value) add(column.title ?? column.key, SKIP)
  for (const column of columns) if (!column.value) addColumn(column.key, column.title)
  for (const key of BUILT_IN) addColumn(key)
  for (const m of all) {
    add(m.idColumn, 'id')
    add(m.parentColumn, 'parent')
  }
  add('id', 'id')
  add('parent', 'parent')
  return names
}

/** Text `toCSV` wrote behind a `'` so that spreadsheets don't run it as a formula: `'-复盘`. */
const unquoteFormula = (text: string) => (/^'[=+\-@\t\r]/.test(text) ? text.slice(1) : text)

const pad = (n: string) => n.padStart(2, '0')

const DATE = /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/

/**
 * A date as tasks write it, from the ways spreadsheets save one:
 * `2026/3/2`, `2026-3-2`, `2026.3.2`, with `9:30` or `09:30:00` after it.
 * `null` when it isn't a date.
 */
export function readCSVDate(text: string) {
  const match = DATE.exec(text.trim())
  if (!match) return null
  const [, y, , m, d, h, mi] = match
  const value = `${y}-${pad(m!)}-${pad(d!)}${h != null ? ` ${pad(h)}:${mi}` : ''}`
  return parseTime(value) ? value : null
}

/** A unit as a message writes it: `{count} 天` is `天`. */
const unitWord = (pattern: string) => format(pattern, { count: '' }).trim().toLowerCase()

/**
 * A number, with a decimal comma in a file split by `;` (`1,5`), as such
 * files are written; kept in step with `readCSV` of `@dou-ui/sheet`.
 */
function readNumber(text: string, comma: boolean) {
  const value = text.trim()
  if (!value || !/^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/.test(value)) return NaN
  if (comma ? value.includes('.') : value.includes(',')) return NaN
  return Number(value.replace(',', '.'))
}

/** A duration with its unit, when it says one: `5`, `5 天`, `2 小时`, `2h`. */
function readDuration(text: string, messages: GanttMessages, comma: boolean) {
  const match = /^([+-]?[\d.,]+)\s*(.*)$/.exec(text.trim())
  if (!match) return null
  const count = readNumber(match[1]!, comma)
  if (Number.isNaN(count)) return null
  const unit = match[2]!.trim().toLowerCase()
  if (!unit) return { count, unit: null }
  const all = [messages, ...Object.values(ganttLocales)]
  if (unit === 'd' || all.some((m) => unitWord(m.days) === unit))
    return { count, unit: 'd' as const }
  if (unit === 'h' || all.some((m) => unitWord(m.hours) === unit))
    return { count, unit: 'h' as const }
  return null
}

export interface ReadCSVContext {
  columns: GanttColumn[]
  messages: GanttMessages
  calendar: WorkCalendar
  /** Tasks outside the file that a task of it may be under, as when appending. */
  outer?: (id: string) => boolean
}

/**
 * Reads the tasks of a CSV file. Throws when no header is the title
 * column, as the file then isn't a list of tasks.
 */
export function readGanttCSV(text: string, context: ReadCSVContext): GanttCSVResult {
  const { columns, messages, calendar } = context
  const delimiter = delimiterOf(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  const comma = delimiter === ';'
  const [head, ...lines] = splitCSV(text, delimiter)
  const names = headerNames(columns, messages)
  const keys = (head ?? []).map((header) => names.get(unquoteFormula(header.trim()).toLowerCase()))
  if (!keys.some((key) => key === 'title'))
    throw new GanttCSVError(
      `[@dou-ui/gantt] No column of the file is the title column; its headers are ${JSON.stringify(head ?? [])}.`,
      'noTitleColumn',
      format(messages.csvNoTitle, { title: messages.columns.title }),
    )
  const unknownColumns = (head ?? []).filter((header, i) => !keys[i] && header.trim())
  keys.forEach((key, i) => {
    if (key === SKIP) keys[i] = undefined
  })
  const byKey = new Map(columns.map((column) => [column.key, column]))
  // a task whose duration and end are both empty is a milestone, as toCSV writes one
  const timing = keys.some((key) => key === 'end' || key?.startsWith('duration'))
  const warnings: GanttCSVWarning[] = []
  const tasks: GanttTask[] = []
  const parents = new Map<GanttTask, { text: string; row: number }>()
  const ids = new Set<string>()

  lines.forEach((fields, index) => {
    const row = index + 2
    if (fields.every((field) => !field.trim())) return
    const cells = new Map<string, string>()
    keys.forEach((key, i) => {
      if (key && !cells.has(key)) cells.set(key, unquoteFormula(fields[i]?.trim() ?? ''))
    })
    const task: GanttTask = { id: '', title: cells.get('title') ?? '' }
    const unread = new Set<string>()
    const warn = (column: string, value: string) => {
      warnings.push({ row, column, text: value })
      unread.add(column)
    }

    const id = cells.get('id')
    if (id && ids.has(id)) warn('id', id)
    task.id = id && !ids.has(id) ? id : createId()
    ids.add(task.id)
    const parent = cells.get('parent')
    if (parent) parents.set(task, { text: parent, row })

    const startText = cells.get('start') ?? ''
    const startValue = startText ? readCSVDate(startText) : null
    const start = startValue ? parseTime(startValue) : null
    if (startText && !start) warn('start', startText)
    const endText = cells.get('end') ?? ''
    const durationKey = keys.find((key) => key?.startsWith('duration'))
    const durationText = durationKey ? cells.get(durationKey)! : ''
    // an end or a duration needs a start to count from
    if (!startText) {
      if (endText) warn('end', endText)
      else if (durationText) warn('duration', durationText)
    }
    if (start) {
      task.start = startValue!
      if (timing && !endText && !durationText) task.type = 'milestone'
      else {
        const unit = start.dateOnly ? MINUTES_PER_DAY : MINUTES_PER_HOUR
        let end: number | null = null
        if (endText) {
          const endValue = readCSVDate(endText)
          const at = endValue ? parseTime(endValue) : null
          const to = at ? at.at + (at.dateOnly ? MINUTES_PER_DAY : 0) : null
          if (to != null && to > start.at) end = to
          else warn('end', endText)
        } else if (durationText) {
          const read = readDuration(durationText, messages, comma)
          const hours = read?.unit
            ? read.unit === 'h'
            : durationKey === 'duration:h' || (durationKey !== 'duration:d' && !start.dateOnly)
          // working days are whole; hours are kept to the minute
          const count = read ? (hours ? Math.round(read.count * 60) : read.count) : 0
          if (!(count > 0) || !Number.isInteger(count)) warn('duration', durationText)
          else
            end = hours
              ? shiftWorkMinutes(calendar, start.at, count)
              : shiftWorkdays(calendar, start.at, count)
        }
        Object.assign(task, writeSpan(task, start.at, end ?? start.at + unit))
      }
    }

    const progress = cells.get('progress')
    if (progress && task.type !== 'milestone') {
      const count = readNumber(progress.replace(/\s*%$/, ''), comma)
      if (Number.isFinite(count)) task.progress = Math.min(100, Math.max(0, count)) / 100
      else warn('progress', progress)
    }

    for (const [key, value] of cells) {
      if (key === 'id' || key === 'parent' || key.startsWith('duration')) continue
      if ((BUILT_IN as readonly string[]).includes(key) || !value) continue
      const column = byKey.get(key)!
      const next = column.parse ? column.parse(value, task) : value
      if (next === undefined) warn(key, value)
      else task.data = { ...task.data, [key]: next }
    }
    if (unread.size) unreadOf.set(task, unread)
    tasks.push(task)
  })

  // parents, once every id is known; a parent that is missing, or one of its own subtasks, is left out
  const byId = new Map(tasks.map((task) => [task.id, task]))
  for (const [task, { text: parent, row }] of parents) {
    let at = byId.get(parent)
    while (at && at !== task) at = at.parent ? byId.get(at.parent) : undefined
    if ((byId.has(parent) && !at) || (!byId.has(parent) && context.outer?.(parent)))
      task.parent = parent
    else {
      warnings.push({ row, column: 'parent', text: parent })
      const unread = unreadOf.get(task) ?? new Set()
      unread.add('parent')
      unreadOf.set(task, unread)
    }
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
  const found = keys
    .filter((key) => key != null)
    .map((key) => (key.startsWith('duration') ? 'duration' : key))
  return { tasks, warnings, columns: [...new Set(found)], unknownColumns }
}

/**
 * Puts the tasks `readGanttCSV` read into a transaction, as
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
    // a task may also go under one the chart has; the file's own ids come first
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
    if (!old) continue
    // a value that couldn't be read leaves the chart's
    const unread = unreadOf.get(task)
    const read = (key: string) => has.has(key) && !unread?.has(key)
    const patch: Partial<GanttTask> = { title: task.title }
    if (read('parent')) patch.parent = task.parent
    // a parent that is removed would take the task with it
    else if (old.parent != null && !keep.has(old.parent)) patch.parent = undefined
    if (read('progress')) patch.progress = task.progress
    const datesRead = !['start', 'end', 'duration'].some((key) => unread?.has(key))
    if (has.has('start') && datesRead) {
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
    const own = [...has].filter((key) => !BUILT_IN_KEYS.has(key) && !unread?.has(key))
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
  // the rest goes with its links, from the end, before the new tasks are added after them
  const now = tr.doc
  const gone = new Set(now.tasks.filter((task) => !keep.has(task.id)).map((task) => task.id))
  if (gone.size) {
    for (let i = now.links.length - 1; i >= 0; i--) {
      const link = now.links[i]!
      if (gone.has(link.from) || gone.has(link.to)) tr.removeLink(link.id)
    }
    for (let i = now.tasks.length - 1; i >= 0; i--) {
      const id = now.tasks[i]!.id
      if (gone.has(id)) tr.step({ type: 'removeTask', id })
    }
  }

  for (const task of result.tasks) if (!tr.getTask(task.id)) tr.addTask(task)

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
    const shown = (tree.childrenOf.get(parent) ?? []).map((task) => task.id)
    if (shown.join('\n') === ids.join('\n')) continue
    const keys = orderKeys(ids.length)
    ids.forEach((id, i) => tr.updateTask(id, { order: keys[i] }))
  }
}
