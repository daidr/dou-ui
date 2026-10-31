import { indentOf, moveCluster, moveWord } from './chars'
import {
  type CodeRange,
  type CodeSelection,
  isEmptyRange,
  mainRange,
  normalizeSelection,
  rangeFrom,
  rangeTo,
} from './selection'
import type { CodeState, CodeTransaction } from './transaction'
import type { CodeText } from './text'

/** What a command works on: the current state and a way to change it. */
export interface CodeCommandTarget {
  readonly state: CodeState
  readonly readonly: boolean
  /** Columns per tab stop. */
  readonly tabSize: number
  /** Indent with tabs instead of spaces. */
  readonly indentWithTabs: boolean
  /** Starts a transaction from the current state. */
  transaction(): CodeTransaction
  dispatch(tr: CodeTransaction): void
  /** Where `range`'s head lands `lines` lines up (negative) or down, keeping its column on screen. */
  moveVertically(range: CodeRange, lines: number): number
  /** How many lines fit on one screen. */
  readonly pageLines: number
  undo(): boolean
  redo(): boolean
}

/** Does something to the editor; returns whether it applied, so a key can fall through when it didn't. */
export type CodeCommand = (target: CodeCommandTarget) => boolean

const lineOf = (doc: CodeText, pos: number) => doc.lineAt(pos)

/** Expands tabs before `col` to get the column on screen, counting one per other character. */
export function visualColumn(text: string, col: number, tabSize: number) {
  let out = 0
  for (let i = 0; i < col; i++)
    out = text.charCodeAt(i) === 9 ? (Math.floor(out / tabSize) + 1) * tabSize : out + 1
  return out
}

const indentUnit = (target: CodeCommandTarget) =>
  target.indentWithTabs ? '\t' : ' '.repeat(target.tabSize)

function setSelection(target: CodeCommandTarget, selection: CodeSelection) {
  const tr = target.transaction()
  tr.select(normalizeSelection(selection, target.state.doc.length)).setMeta({
    action: 'select',
    scroll: true,
  })
  target.dispatch(tr)
  return true
}

/**
 * Moves every range's head with `by`. Without `extend` each range becomes a
 * cursor; `collapse` sends a non-empty range to its start or end instead of
 * moving it (pressing ← on a selection).
 */
function move(
  by: (pos: number, doc: CodeText, range: CodeRange) => number,
  extend: boolean,
  collapse?: -1 | 1,
): CodeCommand {
  return (target) => {
    const { doc, selection } = target.state
    const ranges = selection.ranges.map((range) => {
      if (!extend && collapse && !isEmptyRange(range)) {
        const pos = collapse < 0 ? rangeFrom(range) : rangeTo(range)
        return { anchor: pos, head: pos }
      }
      const head = by(range.head, doc, range)
      return { anchor: extend ? range.anchor : head, head }
    })
    return setSelection(target, { ranges, main: selection.main })
  }
}

const charBy = (dir: 1 | -1) => (pos: number, doc: CodeText) => {
  const line = lineOf(doc, pos)
  const col = pos - line.from
  if (dir < 0 ? col === 0 : col === line.text.length)
    return Math.max(0, Math.min(doc.length, pos + dir))
  return line.from + moveCluster(line.text, col, dir)
}

const wordBy = (dir: 1 | -1) => (pos: number, doc: CodeText) => {
  const line = lineOf(doc, pos)
  const col = pos - line.from
  if (dir < 0 ? col === 0 : col === line.text.length)
    return Math.max(0, Math.min(doc.length, pos + dir))
  return line.from + moveWord(line.text, col, dir)
}

/** First the end of the indentation, then the very start of the line. */
const lineStartBy = (pos: number, doc: CodeText) => {
  const line = lineOf(doc, pos)
  const indent = indentOf(line.text).length
  return line.from + (pos - line.from === indent ? 0 : indent)
}
const lineEndBy = (pos: number, doc: CodeText) => lineOf(doc, pos).to

export const cursorCharLeft = move(charBy(-1), false, -1)
export const cursorCharRight = move(charBy(1), false, 1)
export const selectCharLeft = move(charBy(-1), true)
export const selectCharRight = move(charBy(1), true)
export const cursorWordLeft = move(wordBy(-1), false)
export const cursorWordRight = move(wordBy(1), false)
export const selectWordLeft = move(wordBy(-1), true)
export const selectWordRight = move(wordBy(1), true)
export const cursorLineStart = move(lineStartBy, false)
export const cursorLineEnd = move(lineEndBy, false)
export const selectLineStart = move(lineStartBy, true)
export const selectLineEnd = move(lineEndBy, true)
export const cursorDocStart = move(() => 0, false)
export const cursorDocEnd = move((_, doc) => doc.length, false)
export const selectDocStart = move(() => 0, true)
export const selectDocEnd = move((_, doc) => doc.length, true)

function vertical(lines: number | 'page', extend: boolean): CodeCommand {
  return (target) => {
    const count = lines === 'page' ? target.pageLines : Math.abs(lines)
    const sign = (lines === 'page' ? 1 : Math.sign(lines)) as 1 | -1
    const { selection } = target.state
    const ranges = selection.ranges.map((range) => {
      const head = target.moveVertically(range, sign * count)
      return { anchor: extend ? range.anchor : head, head }
    })
    return setSelection(target, { ranges, main: selection.main })
  }
}

export const cursorLineUp = vertical(-1, false)
export const cursorLineDown = vertical(1, false)
export const selectLineUp = vertical(-1, true)
export const selectLineDown = vertical(1, true)
export const cursorPageUp: CodeCommand = (target) =>
  vertical(-Math.max(1, target.pageLines), false)(target)
export const cursorPageDown: CodeCommand = (target) =>
  vertical(Math.max(1, target.pageLines), false)(target)
export const selectPageUp: CodeCommand = (target) =>
  vertical(-Math.max(1, target.pageLines), true)(target)
export const selectPageDown: CodeCommand = (target) =>
  vertical(Math.max(1, target.pageLines), true)(target)

export const selectAll: CodeCommand = (target) =>
  setSelection(target, { ranges: [{ anchor: 0, head: target.state.doc.length }], main: 0 })

/** Leaves only the main range, then only a cursor; returns false when there was nothing to drop. */
export const simplifySelection: CodeCommand = (target) => {
  const { selection } = target.state
  const main = mainRange(selection)
  if (selection.ranges.length > 1) return setSelection(target, { ranges: [main], main: 0 })
  if (!isEmptyRange(main))
    return setSelection(target, { ranges: [{ anchor: main.head, head: main.head }], main: 0 })
  return false
}

/** Deletes each selection, or from each cursor to where `by` reaches. */
function deleteBy(by: (pos: number, doc: CodeText) => number, action = 'delete'): CodeCommand {
  return (target) => {
    if (target.readonly) return false
    const { doc, selection } = target.state
    const tr = target.transaction().setMeta({ action, scroll: true })
    let last = -1
    for (const range of selection.ranges) {
      let from = rangeFrom(range)
      let to = rangeTo(range)
      if (from === to) {
        const pos = by(range.head, doc)
        from = Math.min(pos, range.head)
        to = Math.max(pos, range.head)
      }
      // Cursors deleting toward each other share what lies between.
      from = Math.max(from, last)
      if (to > from) tr.delete(from, to)
      last = Math.max(last, to)
    }
    if (!tr.docChanged) return false
    target.dispatch(tr)
    return true
  }
}

export const deleteCharBackward = deleteBy(charBy(-1))
export const deleteCharForward = deleteBy(charBy(1))
export const deleteWordBackward = deleteBy(wordBy(-1))
export const deleteWordForward = deleteBy(wordBy(1))
export const deleteLineStart = deleteBy((pos, doc) => {
  const line = lineOf(doc, pos)
  return pos === line.from ? Math.max(0, pos - 1) : line.from
})
export const deleteLineEnd = deleteBy((pos, doc) => {
  const line = lineOf(doc, pos)
  return pos === line.to ? Math.min(doc.length, pos + 1) : line.to
})

/** A line break that keeps the indentation of the line it breaks. */
export const insertNewline: CodeCommand = (target) => {
  if (target.readonly) return false
  const { doc } = target.state
  const tr = target.transaction().setMeta({ action: 'input', scroll: true })
  tr.replaceSelection((range) => {
    const line = lineOf(doc, rangeFrom(range))
    return '\n' + indentOf(line.text).slice(0, rangeFrom(range) - line.from)
  })
  target.dispatch(tr)
  return true
}

/** The lines each range covers; a range ending at a line's very start leaves that line out. */
function coveredLines(doc: CodeText, selection: CodeSelection) {
  const lines = new Set<number>()
  for (const range of selection.ranges) {
    const from = doc.lineAt(rangeFrom(range))
    let to = doc.lineAt(rangeTo(range))
    if (to.number > from.number && rangeTo(range) === to.from) to = doc.line(to.number - 1)
    for (let n = from.number; n <= to.number; n++) lines.add(n)
  }
  return [...lines]
}

export const indentMore: CodeCommand = (target) => {
  if (target.readonly) return false
  const { doc, selection } = target.state
  const tr = target.transaction().setMeta({ action: 'indent', scroll: true })
  const unit = indentUnit(target)
  for (const n of coveredLines(doc, selection)) {
    const line = doc.line(n)
    if (line.text || selection.ranges.length === 1) tr.insert(line.from, unit)
  }
  target.dispatch(tr)
  return true
}

export const indentLess: CodeCommand = (target) => {
  if (target.readonly) return false
  const { doc, selection } = target.state
  const tr = target.transaction().setMeta({ action: 'indent', scroll: true })
  for (const n of coveredLines(doc, selection)) {
    const line = doc.line(n)
    const indent = indentOf(line.text)
    if (!indent) continue
    // One tab, or spaces back to the previous tab stop.
    let cut = 0
    if (indent[0] === '\t') cut = 1
    else while (cut < indent.length && cut < target.tabSize && indent[cut] === ' ') cut++
    tr.delete(line.from, line.from + cut)
  }
  if (!tr.docChanged) return true
  target.dispatch(tr)
  return true
}

/** Tab: indents selected lines, otherwise fills to the next tab stop at each cursor. */
export const insertTab: CodeCommand = (target) => {
  if (target.readonly) return false
  const { doc, selection } = target.state
  const multiline = selection.ranges.some(
    (range) => doc.lineAt(rangeFrom(range)).number !== doc.lineAt(rangeTo(range)).number,
  )
  if (multiline) return indentMore(target)
  const tr = target.transaction().setMeta({ action: 'input', scroll: true })
  tr.replaceSelection((range) => {
    if (target.indentWithTabs) return '\t'
    const line = lineOf(doc, rangeFrom(range))
    const column = visualColumn(line.text, rangeFrom(range) - line.from, target.tabSize)
    return ' '.repeat(target.tabSize - (column % target.tabSize))
  })
  target.dispatch(tr)
  return true
}

export const undo: CodeCommand = (target) => target.undo()
export const redo: CodeCommand = (target) => target.redo()
