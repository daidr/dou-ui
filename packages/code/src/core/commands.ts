import type { CodeLanguage, CodeTokenType } from '../language/language'
import { findPartner, matchBracket } from './brackets'
import { indentOf, moveCluster, moveWord, wordAt } from './chars'
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
  /** The text's language, if it has one. */
  readonly language: CodeLanguage | null
  /** The language at a position: an inner one inside a language that holds others, e.g. a `<script>` in HTML. */
  languageAt(pos: number): CodeLanguage | null
  /** The kind of token the character at `pos` belongs to, when it is known. */
  syntaxAt(pos: number): CodeTokenType | null
  /** Typing an opening bracket or quote also types its partner. */
  readonly closeBrackets: boolean
  /** The editor's search panel, when it has one. */
  readonly search?: CodeSearchControl
}

/** What commands can do with the editor's search panel. */
export interface CodeSearchControl {
  /** Opens the panel (with the replace box when `replace` is set) and focuses it. */
  open(replace?: boolean): void
  /** Closes the panel; `false` when it wasn't open. */
  close(): boolean
  /** Selects the next match; `false` without matches. */
  next(): boolean
  /** Selects the previous match; `false` without matches. */
  previous(): boolean
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

/** The word around a cursor (after it, else before it), as a range, or `null` when it touches none. */
function wordRange(doc: CodeText, pos: number): CodeRange | null {
  const line = lineOf(doc, pos)
  const col = pos - line.from
  for (const at of [col, col - 1]) {
    if (at < 0 || at >= line.text.length || !WORD.test(line.text[at]!)) continue
    const word = wordAt(line.text, at)
    return { anchor: line.from + word.from, head: line.from + word.to }
  }
  return null
}

const WORD = /[\p{L}\p{N}_$]/u

const isWholeWord = (all: string, at: number, length: number) =>
  !WORD.test(all[at - 1] ?? '') && !WORD.test(all[at + length] ?? '')

/** Where `text` occurs first at or after `from`, wrapping around to the start; a whole word only when `word` is set. */
function nextOccurrence(all: string, text: string, from: number, word: boolean): number | null {
  for (let at = all.indexOf(text, from); at >= 0; at = all.indexOf(text, at + 1))
    if (!word || isWholeWord(all, at, text.length)) return at
  for (let at = all.indexOf(text); at >= 0 && at < from; at = all.indexOf(text, at + 1))
    if (!word || isWholeWord(all, at, text.length)) return at
  return null
}

/**
 * Selects the word at the cursor; with a selection, adds the next place
 * the same text occurs as another selection (wrapping around the end).
 */
export const selectNextOccurrence: CodeCommand = (target) => {
  const { doc, selection } = target.state
  const main = mainRange(selection)
  if (isEmptyRange(main)) {
    const word = wordRange(doc, main.head)
    if (!word) return false
    const ranges = selection.ranges.slice()
    ranges[selection.main] = word
    return setSelection(target, { ranges, main: selection.main })
  }
  const text = doc.slice(rangeFrom(main), rangeTo(main))
  // A selection made from a word looks for whole words only.
  const word = isWordAt(doc, main)
  const all = doc.toString()
  const taken = new Set(selection.ranges.map(rangeFrom))
  let at = nextOccurrence(all, text, Math.max(...selection.ranges.map(rangeTo)), word)
  // Skips places already selected; gives up once it comes round to one again.
  const seen = new Set<number>()
  while (at !== null && taken.has(at) && !seen.has(at)) {
    seen.add(at)
    at = nextOccurrence(all, text, at + 1, word)
  }
  if (at !== null && taken.has(at)) at = null
  if (at === null) return false
  const ranges = [...selection.ranges, { anchor: at, head: at + text.length }]
  return setSelection(target, { ranges, main: ranges.length - 1 })
}

/** Selects every place the selected text (or the word at the cursor) occurs. */
export const selectAllOccurrences: CodeCommand = (target) => {
  const { doc, selection } = target.state
  let main = mainRange(selection)
  let word = isWordAt(doc, main)
  if (isEmptyRange(main)) {
    const found = wordRange(doc, main.head)
    if (!found) return false
    main = found
    word = true
  }
  const text = doc.slice(rangeFrom(main), rangeTo(main))
  const all = doc.toString()
  const ranges: CodeRange[] = []
  let mainIndex = 0
  for (let at = all.indexOf(text); at >= 0; at = all.indexOf(text, at + text.length)) {
    if (word && !isWholeWord(all, at, text.length)) continue
    if (at === rangeFrom(main)) mainIndex = ranges.length
    ranges.push({ anchor: at, head: at + text.length })
  }
  if (!ranges.length) return false
  return setSelection(target, { ranges, main: mainIndex })
}

/** Whether a range covers exactly one whole word. */
function isWordAt(doc: CodeText, range: CodeRange) {
  if (isEmptyRange(range)) return false
  const word = wordRange(doc, rangeFrom(range))
  return !!word && word.anchor === rangeFrom(range) && word.head === rangeTo(range)
}

function addCursor(dir: -1 | 1): CodeCommand {
  return (target) => {
    const { selection } = target.state
    const ranges = selection.ranges.slice()
    // From the outermost cursor in that direction, one line further.
    const edge = dir < 0 ? selection.ranges[0]! : selection.ranges[selection.ranges.length - 1]!
    const head = target.moveVertically({ anchor: edge.head, head: edge.head }, dir)
    if (head === edge.head) return false
    ranges.push({ anchor: head, head })
    return setSelection(target, { ranges, main: ranges.length - 1 })
  }
}

/** Adds a cursor on the line above the topmost one. */
export const addCursorAbove = addCursor(-1)
/** Adds a cursor on the line below the bottommost one. */
export const addCursorBelow = addCursor(1)

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

const plainDeleteBackward = deleteBy(charBy(-1))

/** Backspace; between a pair of brackets or quotes, `(|)`, it deletes both. */
export const deleteCharBackward: CodeCommand = (target) => {
  if (target.readonly) return false
  const { doc, selection } = target.state
  if (target.closeBrackets && selection.ranges.every(isEmptyRange)) {
    const pairs = target.state.selection.ranges.map((range) => {
      const before = doc.slice(range.head - 1, range.head)
      const after = doc.slice(range.head, range.head + 1)
      const language = target.languageAt(range.head)
      return !!before && !!language && after === partnerOf(language, before)
    })
    if (pairs.every(Boolean)) {
      const tr = target.transaction().setMeta({ action: 'delete', scroll: true })
      for (const range of selection.ranges) tr.delete(range.head - 1, range.head + 1)
      target.dispatch(tr)
      return true
    }
  }
  return plainDeleteBackward(target)
}
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

/**
 * A line break that keeps the indentation. After an opening bracket (or
 * what the language indents after, such as an HTML tag) it indents one
 * more; between a pair, `{|}`, it puts the closing one on a line of its own.
 */
export const insertNewline: CodeCommand = (target) => {
  if (target.readonly) return false
  const { doc } = target.state
  const unit = indentUnit(target)
  replaceEach(target, 'input', (range) => {
    const from = rangeFrom(range)
    const to = rangeTo(range)
    const line = lineOf(doc, from)
    const before = line.text.slice(0, from - line.from)
    const end = lineOf(doc, to)
    const after = end.text.slice(to - end.from)
    const indent = indentOf(line.text).slice(0, before.length)
    const language = target.languageAt(from)
    const opener = opensBlock(target, language, before, from)
    if (!opener) return { from, to, insert: '\n' + indent }
    const inner = '\n' + indent + unit
    const closing = opener === '<' ? /^\s*<\//.test(after) : after.trimStart()[0] === opener
    if (!closing) return { from, to, insert: inner }
    return { from, to, insert: inner + '\n' + indent, cursor: inner.length }
  })
  return true
}

/**
 * What opens a block at the end of `before`: the closing partner of an
 * opening bracket (outside strings and comments), `'<'` for what the
 * language indents after, or `null`.
 */
function opensBlock(
  target: CodeCommandTarget,
  language: CodeLanguage | null,
  before: string,
  pos: number,
): string | null {
  const trimmed = before.trimEnd()
  const last = trimmed[trimmed.length - 1]
  const brackets = language?.brackets ?? '()[]{}'
  const index = last === undefined ? -1 : brackets.indexOf(last)
  if (index >= 0 && index % 2 === 0) {
    const at = pos - (before.length - trimmed.length) - 1
    const kind = target.syntaxAt(at)
    if (kind !== 'string' && kind !== 'comment') return brackets[index + 1]!
  }
  if (language?.indentAfter?.test(before)) return '<'
  return null
}

/** The closing partner of an opening bracket or quote, when the language pairs it. */
function partnerOf(language: CodeLanguage, ch: string): string | null {
  if (!language.autoClose.includes(ch)) return null
  const index = language.brackets.indexOf(ch)
  if (index >= 0) return index % 2 === 0 ? language.brackets[index + 1]! : null
  return ch
}

/** One replacement per range, with where its cursor lands inside `insert` (the end by default). */
interface Edit {
  from: number
  to: number
  insert: string
  /** Offset in `insert` of the cursor; with `anchor`, a selection inside it. */
  cursor?: number
  anchor?: number
}

/** Applies an edit for every range as one step, and puts each cursor where its edit says. */
function replaceEach(target: CodeCommandTarget, action: string, edit: (range: CodeRange) => Edit) {
  const tr = target.transaction().setMeta({ action, scroll: true })
  const { selection } = target.state
  let shift = 0
  const ranges: CodeRange[] = []
  for (const range of selection.ranges) {
    const { from, to, insert, cursor = insert.length, anchor = cursor } = edit(range)
    tr.replace(from, to, insert)
    const at = from + shift
    ranges.push({ anchor: at + anchor, head: at + cursor })
    shift += insert.length - (to - from)
  }
  tr.select({ ranges, main: selection.main })
  target.dispatch(tr)
}

/** Whether a character is one that typing a bracket pair before is fine: space, the end, or a closer. */
const pairsBefore = (ch: string | undefined, language: CodeLanguage) =>
  ch === undefined || /[\s;,:.]/.test(ch) || closers(language).includes(ch)

const closers = (language: CodeLanguage) => {
  let out = ''
  for (let i = 1; i < language.brackets.length; i += 2) out += language.brackets[i]
  return out
}

/**
 * Types `text` at every cursor, as typing does, with the help of the
 * language: an opening bracket or quote brings its partner, a closing one
 * steps over the partner already there, a selection gets wrapped, and a
 * closing bracket typed on a blank line lines up with its opener.
 * Returns `false` when it would only type the text, so the caller does that.
 */
export function insertText(target: CodeCommandTarget, text: string): boolean {
  if (target.readonly || [...text].length !== 1) return false
  const { doc, selection } = target.state
  const language = target.language
  if (!language) return false
  let changed = false
  const edits: Edit[] = selection.ranges.map((range) => {
    const from = rangeFrom(range)
    const to = rangeTo(range)
    const plain = { from, to, insert: text }
    const lang = target.languageAt(from) ?? language
    if (!target.closeBrackets) return plain
    const after = doc.slice(to, to + 1)
    const before = doc.slice(from - 1, from)
    const partner = partnerOf(lang, text)
    // A closer (or quote) typed right before the same one steps over it.
    if (from === to && after === text && (closers(lang).includes(text) || partner === text)) {
      changed = true
      return { from, to: from, insert: '', cursor: 1 }
    }
    if (!partner) return plain
    // Wraps the selection, keeping it selected inside the pair.
    if (from !== to) {
      changed = true
      const inner = doc.slice(from, to)
      return { from, to, insert: text + inner + partner, anchor: 1, cursor: inner.length + 1 }
    }
    const kind = target.syntaxAt(from - 1)
    if (partner === text) {
      // A quote pairs only between words, not inside a string or after a letter (it's, don't).
      if (/[\p{L}\p{N}_]/u.test(before) || kind === 'string' || kind === 'comment') return plain
    } else if (kind === 'comment') return plain
    if (!pairsBefore(after || undefined, lang)) return plain
    changed = true
    return { from, to, insert: text + partner, cursor: 1 }
  })
  if (changed) {
    let i = 0
    replaceEach(target, 'input', () => edits[i++]!)
    return true
  }
  return reindentCloser(target, text)
}

/** A closing bracket typed on a blank line moves the line to its opener's indentation. */
function reindentCloser(target: CodeCommandTarget, text: string): boolean {
  const language = target.language
  if (!language) return false
  const { doc, selection } = target.state
  if (selection.ranges.length !== 1 || !isEmptyRange(selection.ranges[0]!)) return false
  const pos = selection.ranges[0]!.head
  const lang = target.languageAt(pos) ?? language
  const index = lang.brackets.indexOf(text)
  if (index < 0 || index % 2 === 0) return false
  const line = lineOf(doc, pos)
  if (line.text.slice(0, pos - line.from).trim()) return false
  // Where the opener is, as if the closer were already typed.
  const typed = doc.replace(pos, pos, text)
  const opener = findPartner(typed, pos, lang.brackets, index, (at) => {
    const kind = at < pos ? target.syntaxAt(at) : null
    return kind === 'string' || kind === 'comment'
  })
  if (opener === null) return false
  const indent = indentOf(lineOf(doc, opener).text)
  const tr = target.transaction().setMeta({ action: 'input', scroll: true })
  tr.replace(line.from, pos, indent + text)
  tr.select(line.from + indent.length + 1)
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

/** The covered lines as runs of neighbours: `[first, last]` line numbers. */
function lineBlocks(doc: CodeText, selection: CodeSelection): Array<[number, number]> {
  const lines = coveredLines(doc, selection)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  lines.sort((a, b) => a - b)
  const blocks: Array<[number, number]> = []
  for (const n of lines) {
    const last = blocks[blocks.length - 1]
    if (last && n <= last[1] + 1) last[1] = Math.max(last[1], n)
    else blocks.push([n, n])
  }
  return blocks
}

/** Shifts every range by what `offset` says for its position. */
function shiftSelection(selection: CodeSelection, offset: (pos: number) => number): CodeSelection {
  return {
    ranges: selection.ranges.map((range) => ({
      anchor: range.anchor + offset(range.anchor),
      head: range.head + offset(range.head),
    })),
    main: selection.main,
  }
}

function moveLines(dir: -1 | 1): CodeCommand {
  return (target) => {
    if (target.readonly) return false
    const { doc, selection } = target.state
    const blocks = lineBlocks(doc, selection)
    if (blocks.some(([first, last]) => (dir < 0 ? first === 1 : last === doc.lines))) return false
    const tr = target.transaction().setMeta({ action: 'move', scroll: true })
    const moves: Array<{ from: number; to: number; by: number }> = []
    for (const [first, last] of blocks) {
      const start = doc.line(first)
      const end = doc.line(last)
      const block = doc.slice(start.from, end.to)
      if (dir < 0) {
        const above = doc.line(first - 1)
        tr.replace(above.from, end.to, block + '\n' + above.text)
        moves.push({ from: start.from, to: end.to, by: -(above.text.length + 1) })
      } else {
        const below = doc.line(last + 1)
        tr.replace(start.from, below.to, below.text + '\n' + block)
        moves.push({ from: start.from, to: end.to, by: below.text.length + 1 })
      }
    }
    tr.select(
      shiftSelection(selection, (pos) => {
        const moved = moves.find((m) => pos >= m.from && pos <= m.to)
        return moved ? moved.by : 0
      }),
    )
    target.dispatch(tr)
    return true
  }
}

/** Moves the lines with a cursor or selection up one line. */
export const moveLineUp = moveLines(-1)
/** Moves the lines with a cursor or selection down one line. */
export const moveLineDown = moveLines(1)

function copyLines(dir: -1 | 1): CodeCommand {
  return (target) => {
    if (target.readonly) return false
    const { doc, selection } = target.state
    const blocks = lineBlocks(doc, selection)
    const tr = target.transaction().setMeta({ action: 'copy', scroll: true })
    const copies: Array<{ from: number; to: number; at: number; length: number }> = []
    for (const [first, last] of blocks) {
      const start = doc.line(first)
      const end = doc.line(last)
      const block = doc.slice(start.from, end.to)
      if (dir < 0) tr.insert(start.from, block + '\n')
      else tr.insert(end.to, '\n' + block)
      copies.push({ from: start.from, to: end.to, at: start.from, length: block.length + 1 })
    }
    // Up: the cursor stays on the upper copy; down: it goes with the new lower one.
    tr.select(
      shiftSelection(selection, (pos) => {
        let by = 0
        for (const copy of copies) {
          if (copy.to < pos) by += copy.length
          else if (dir > 0 && pos >= copy.from) by += copy.length
        }
        return by
      }),
    )
    target.dispatch(tr)
    return true
  }
}

/** Copies the lines with a cursor or selection above them; the cursor stays on the upper copy. */
export const copyLineUp = copyLines(-1)
/** Copies the lines with a cursor or selection below them, and moves the cursor to the copy. */
export const copyLineDown = copyLines(1)

/** Deletes the lines with a cursor or selection, line breaks and all. */
export const deleteLine: CodeCommand = (target) => {
  if (target.readonly) return false
  const { doc, selection } = target.state
  const tr = target.transaction().setMeta({ action: 'delete', scroll: true })
  for (const [first, last] of lineBlocks(doc, selection)) {
    const start = doc.line(first)
    const end = doc.line(last)
    if (last < doc.lines) tr.delete(start.from, end.to + 1)
    else tr.delete(Math.max(0, start.from - 1), end.to)
  }
  if (!tr.docChanged) return false
  target.dispatch(tr)
  return true
}

/**
 * Comments the lines with a cursor or selection out, or back in when they
 * all are: with the language's line comment (`//`), or wrapped in its block
 * comment (`<!-- … -->`) when it has none. Inside a language held by
 * another (a `<script>` in HTML), the inner language's comments are used.
 */
export const toggleComment: CodeCommand = (target) => {
  if (target.readonly) return false
  const { selection } = target.state
  const main = mainRange(selection)
  const language = target.languageAt(rangeFrom(main)) ?? target.language
  if (!language) return false
  const { line: token, block } = language.comment
  if (token) return toggleLineComment(target, token)
  if (block) return toggleBlockComment(target, block)
  return false
}

function toggleLineComment(target: CodeCommandTarget, token: string) {
  const { doc, selection } = target.state
  const lines = coveredLines(doc, selection).map((n) => doc.line(n))
  const filled = lines.filter((line) => line.text.trim())
  if (!filled.length) return false
  const commented = filled.every((line) => line.text.trimStart().startsWith(token))
  const tr = target.transaction().setMeta({ action: 'comment', scroll: true })
  if (commented) {
    for (const line of filled) {
      const at = line.from + indentOf(line.text).length
      const space = line.text[at - line.from + token.length] === ' ' ? 1 : 0
      tr.delete(at, at + token.length + space)
    }
  } else {
    // At the smallest indentation, so the comment marks line up.
    const column = Math.min(...filled.map((line) => indentOf(line.text).length))
    for (const line of filled) tr.insert(line.from + column, token + ' ')
  }
  target.dispatch(tr)
  return true
}

function toggleBlockComment(target: CodeCommandTarget, [open, close]: [string, string]) {
  const { doc, selection } = target.state
  const tr = target.transaction().setMeta({ action: 'comment', scroll: true })
  for (const range of selection.ranges) {
    let from = rangeFrom(range)
    let to = rangeTo(range)
    // A cursor comments its whole line, without the indentation.
    if (from === to) {
      const line = lineOf(doc, from)
      from = line.from + indentOf(line.text).length
      to = line.to
    }
    const text = doc.slice(from, to)
    const inner = text.trim()
    if (
      inner.startsWith(open) &&
      inner.endsWith(close) &&
      inner.length >= open.length + close.length
    ) {
      const start = from + text.indexOf(open)
      const end = from + text.lastIndexOf(close)
      const openSpace = doc.slice(start + open.length, start + open.length + 1) === ' ' ? 1 : 0
      const closeSpace = end > start + open.length && doc.slice(end - 1, end) === ' ' ? 1 : 0
      tr.delete(start, start + open.length + openSpace)
      tr.delete(end - closeSpace, end + close.length)
    } else if (from < to) {
      tr.insert(from, open + ' ')
      tr.insert(to, ' ' + close)
    }
  }
  if (!tr.docChanged) return false
  target.dispatch(tr)
  return true
}

/** Moves the cursor to the bracket matching the one next to it. */
export const cursorMatchingBracket: CodeCommand = (target) => {
  const { doc, selection } = target.state
  const brackets = target.language?.brackets ?? '()[]{}'
  const skip = (pos: number) => {
    const kind = target.syntaxAt(pos)
    return kind === 'string' || kind === 'comment'
  }
  let moved = false
  const ranges = selection.ranges.map((range) => {
    const found = matchBracket(doc, range.head, brackets, skip)
    if (!found || found.match === null) return range
    moved = true
    // Lands just before the partner.
    const head = found.match
    return { anchor: head, head }
  })
  if (!moved) return false
  return setSelection(target, { ranges, main: selection.main })
}

/** Opens the search panel, filled with the selected text. */
export const openSearch: CodeCommand = (target) => {
  if (!target.search) return false
  target.search.open()
  return true
}

/** Opens the search panel with the replace box. */
export const openReplace: CodeCommand = (target) => {
  if (!target.search || target.readonly) return false
  target.search.open(true)
  return true
}

/** Selects the next match of the search. */
export const findNext: CodeCommand = (target) => !!target.search?.next()
/** Selects the previous match of the search. */
export const findPrevious: CodeCommand = (target) => !!target.search?.previous()
/** Closes the search panel. */
export const closeSearch: CodeCommand = (target) => !!target.search?.close()
