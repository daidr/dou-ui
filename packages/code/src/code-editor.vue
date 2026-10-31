<script setup lang="ts">
import { holdPointer, isApplePlatform, isComposing, useNamespace } from 'dou-ui'
import {
  computed,
  getCurrentInstance,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  toRaw,
  watch,
} from 'vue'
import type { ChangeSet } from './core/changes'
import { moveCluster, snapCluster, wordAt } from './core/chars'
import type { CodeCommand, CodeCommandTarget } from './core/commands'
import { deleteCharBackward, deleteCharForward, insertNewline } from './core/commands'
import { CodeHistory } from './core/history'
import { buildKeymap, defaultKeymap, eventKey } from './core/keymap'
import {
  type CodeRange,
  type CodeSelection,
  isEmptyRange,
  mainRange,
  normalizeSelection,
  rangeFrom,
  rangeTo,
  sameSelection,
  selectionOf,
} from './core/selection'
import { CodeText, splitLines } from './core/text'
import {
  CodeTransaction,
  type CodeState,
  type CodeTransactionMeta,
  type CodeTransactionResult,
} from './core/transaction'
import type { CodeEditorEmits, CodeEditorExpose, CodeEditorProps } from './types'
import { diffText } from './view/input'
import { Measure } from './view/measure'

defineOptions({ name: 'DouCodeEditor' })

const props = withDefaults(defineProps<CodeEditorProps>(), {
  modelValue: undefined,
  doc: undefined,
  selection: undefined,
  lineNumbers: true,
  activeLine: true,
  tabSize: 2,
})
const emit = defineEmits<CodeEditorEmits>()
const ns = useNamespace('code-editor')
const instance = getCurrentInstance()!

/** Space above the first line and below the last. */
const PAD_Y = 8
const PAD_X = 12
/** Browsers stop growing an element somewhere past 16M px; taller texts scroll in scaled steps. */
const MAX_HEIGHT = 8_000_000
const OVERSCAN = 6
/** The textarea mirrors at most this much text around the cursor. */
const WINDOW = 4000

const apple = isApplePlatform()

// ---------------------------------------------------------------- state

// A ref around the text makes a deep proxy of it; the editor reads the plain object.
const initialDoc = () =>
  (props.doc && toRaw(props.doc)) ??
  (props.modelValue !== undefined ? CodeText.of(props.modelValue) : CodeText.empty)
const startDoc = initialDoc()
const state = shallowRef<CodeState>(
  markRaw({
    doc: startDoc,
    selection: normalizeSelection(toRaw(props.selection) ?? selectionOf(0), startDoc.length),
  }),
)
const doc = computed(() => state.value.doc)
const history = markRaw(new CodeHistory())
const historyTick = ref(0)

/** The last string handed out, for the text it was made from, so it is joined at most once. */
let joined: { doc: CodeText; text: string } | null = null
const textOf = (text: CodeText) => {
  if (joined?.doc !== text) joined = { doc: text, text: text.toString() }
  return joined.text
}
const listens = (event: string) => !!instance.vnode.props?.[event]
let lazyDirty = false
/** Values this editor handed out; seeing one come back through a prop is only an echo. */
const handedOut = new WeakSet<object>()
function emitDoc(value: CodeText) {
  handedOut.add(value)
  emit('update:doc', value)
}
function emitSelection(value: CodeSelection) {
  handedOut.add(value)
  emit('update:selection', value)
}

function emitChange(result: CodeTransactionResult) {
  const { state: next, before, changes } = result
  if (!changes.empty) {
    emitDoc(next.doc)
    if (props.modelModifiers?.lazy) lazyDirty = true
    else if (listens('onUpdate:modelValue')) emit('update:modelValue', textOf(next.doc))
  }
  if (!sameSelection(next.selection, before.selection)) emitSelection(next.selection)
  emit('transaction', result)
}

// ---------------------------------------------------------------- transactions

/** Goal x of each cursor moved up or down, so it keeps its column across short lines. */
let goals = new Map<number, number>()
let pendingGoals = new Map<number, number>()
const blink = ref(0)

function dispatch(tr: CodeTransaction): CodeTransactionResult | null {
  const result = tr.resolve()
  const before = state.value
  if (result.changes.empty && sameSelection(result.state.selection, before.selection)) {
    pendingGoals = new Map()
    return null
  }
  if (!result.changes.empty) {
    history.record(result)
    historyTick.value++
  }
  state.value = markRaw(result.state)
  goals = pendingGoals
  pendingGoals = new Map()
  blink.value++
  if (!composing.value) syncInput()
  emitChange(result)
  if (result.meta.scroll ?? !result.changes.empty) nextTick(() => scrollIntoView())
  return result
}

const transaction = () => new CodeTransaction(state.value)

function transact(build: (tr: CodeTransaction) => void, meta?: CodeTransactionMeta) {
  const tr = transaction()
  if (meta) tr.setMeta(meta)
  build(tr)
  return dispatch(tr)
}

function applySteps(step: { changes: ChangeSet; selection: CodeSelection } | null, action: string) {
  if (!step) return false
  const tr = transaction().setMeta({ action, history: false, scroll: true })
  for (const change of step.changes.changes) tr.replace(change.from, change.to, change.insert)
  tr.select(step.selection)
  dispatch(tr)
  return true
}

const undo = () => !props.readonly && applySteps(history.undo(), 'undo')
const redo = () => !props.readonly && applySteps(history.redo(), 'redo')

/**
 * Takes in a new text from outside as the smallest change, so the cursor
 * and undo survive. `given` is the text as a `CodeText` when it came in as
 * one; it is kept as it is, so it compares equal when it comes back.
 */
function receive(next: string, given?: CodeText) {
  if (joined && joined.text === next && joined.doc === doc.value) return
  const old = textOf(doc.value)
  const normalized = next.includes('\r') ? next.replace(/\r\n?/g, '\n') : next
  const diff = diffText(old, normalized, mainRange(state.value.selection).head)
  if (!diff) {
    if (given) state.value = markRaw({ ...state.value, doc: given })
    return
  }
  const tr = transaction().setMeta({ action: 'external', scroll: false })
  tr.replace(diff.from, diff.to, diff.insert)
  const resolved = tr.resolve()
  const result = given
    ? { ...resolved, state: markRaw({ ...resolved.state, doc: given }) }
    : resolved
  history.record(result)
  historyTick.value++
  state.value = markRaw(result.state)
  joined = { doc: result.state.doc, text: normalized }
  if (!composing.value) syncInput()
  if (!sameSelection(result.state.selection, result.before.selection))
    emitSelection(result.state.selection)
  // Hand the new text back in the other shape only; the one it came in is already up to date.
  if (!given) emitDoc(result.state.doc)
  else if (listens('onUpdate:modelValue')) emit('update:modelValue', normalized)
  emit('transaction', result)
}

watch(
  () => props.modelValue,
  (value) => value !== undefined && receive(value),
)
watch(
  () => props.doc && toRaw(props.doc),
  (value) => {
    if (!value || value === doc.value || handedOut.has(value)) return
    receive(value.toString(), value)
  },
)
watch(
  () => props.selection && toRaw(props.selection),
  (value) => {
    if (!value || handedOut.has(value)) return
    const next = normalizeSelection(value, doc.value.length)
    if (sameSelection(next, state.value.selection)) return
    dispatch(transaction().select(next).setMeta({ scroll: true }))
  },
)

// ---------------------------------------------------------------- layout

const root = ref<HTMLElement>()
const scroller = ref<HTMLElement>()
const content = ref<HTMLElement>()
const probe = ref<HTMLElement>()
const input = ref<HTMLTextAreaElement>()
const measure = markRaw(new Measure(() => probe.value))
/** Bumped when the font metrics change, so everything drawn from them is worked out again. */
const metrics = ref(0)

const scrollTop = ref(0)
const viewHeight = ref(0)
const viewWidth = ref(0)
/** The part of the scroller that is inside the window, for an editor taller than the page. */
const clip = ref<{ top: number; bottom: number } | null>(null)

const lineHeight = computed(() => {
  void metrics.value
  return measure.lineHeight
})
const total = computed(() => doc.value.lines * lineHeight.value)
const sizerHeight = computed(() => Math.min(total.value, MAX_HEIGHT) + PAD_Y * 2)
/** How much faster than the scrollbar the text moves, above `MAX_HEIGHT`. */
const ratio = computed(() => {
  if (total.value <= MAX_HEIGHT) return 1
  const view = viewHeight.value || 1
  return Math.max(1, (total.value - view) / Math.max(1, MAX_HEIGHT - view))
})
/** Offset between the text's own y and where it is drawn in the scaled scroller. */
const shift = computed(() => scrollTop.value - scrollTop.value * ratio.value)
const yOf = (line: number) => PAD_Y + (line - 1) * lineHeight.value + shift.value

const visibleFrom = computed(() => {
  const top = scrollTop.value * ratio.value + (clip.value?.top ?? 0)
  return Math.max(1, Math.floor((top - PAD_Y) / lineHeight.value) + 1 - OVERSCAN)
})
const visibleTo = computed(() => {
  const bottom = scrollTop.value * ratio.value + (clip.value?.bottom ?? viewHeight.value)
  return Math.min(doc.value.lines, Math.ceil((bottom - PAD_Y) / lineHeight.value) + OVERSCAN)
})

/** The text of the lines in view; a lot of lines in each, so computed once per frame. */
const lines = computed(() => doc.value.lineTexts(visibleFrom.value, visibleTo.value))
const lineText = (n: number) =>
  n >= visibleFrom.value && n <= visibleTo.value
    ? lines.value[n - visibleFrom.value]!
    : doc.value.line(n).text

const gutterWidth = computed(() => {
  if (!props.lineNumbers) return 0
  void metrics.value
  const digits = Math.max(2, String(doc.value.lines).length)
  return Math.ceil(digits * measure.cell) + 28
})

const contentWidth = computed(() => {
  void metrics.value
  let widest = doc.value.widest * measure.cell
  for (const text of lines.value) {
    if (text.length * measure.cell * 2 < widest) continue
    widest = Math.max(widest, measure.x(text, text.length))
  }
  return Math.ceil(widest + PAD_X * 2 + measure.cell)
})

// ---------------------------------------------------------------- composition

const composing = ref(false)
/** What the input method shows while composing: a replacement of the text, drawn but not applied yet. */
const preview = shallowRef<{ from: number; to: number; insert: string } | null>(null)

interface Row {
  n: number
  text: string
  /** Set on the line being composed: the text drawn before, inside and after the composition. */
  compose?: [before: string, insert: string, after: string]
}

const rows = computed<Row[]>(() => {
  const from = visibleFrom.value
  const p = preview.value
  const line = p ? doc.value.lineAt(p.from) : null
  return lines.value.map((text, i) => {
    const n = from + i
    if (!p || n !== line!.number) return { n, text }
    const col = p.from - line!.from
    const end = p.to <= line!.to ? p.to - line!.from : col
    return { n, text, compose: [text.slice(0, col), p.insert, text.slice(end)] }
  })
})

// ---------------------------------------------------------------- overlays

const focused = ref(false)

interface Box {
  key: string
  left: number
  top: number
  width: number
}

const cursors = computed(() => {
  void metrics.value
  const out: Box[] = []
  const { doc: text, selection } = state.value
  const p = preview.value
  selection.ranges.forEach((range, i) => {
    let pos = range.head
    const line = text.lineAt(pos)
    if (line.number < visibleFrom.value || line.number > visibleTo.value) return
    let lineStr = lineText(line.number)
    if (p && i === selection.main) {
      const at = text.lineAt(p.from)
      lineStr =
        rows.value
          .find((row) => row.n === at.number)
          ?.compose?.slice(0, 2)
          .join('') ?? lineStr
      out.push({
        key: `c${i}`,
        left: PAD_X + measure.x(lineStr, lineStr.length),
        top: yOf(at.number),
        width: 2,
      })
      return
    }
    pos -= line.from
    out.push({
      key: `c${i}`,
      left: PAD_X + measure.x(lineStr, pos),
      top: yOf(line.number),
      width: 2,
    })
  })
  return out
})

const selectionBoxes = computed(() => {
  void metrics.value
  if (preview.value) return []
  const out: Box[] = []
  const { doc: text, selection } = state.value
  const first = visibleFrom.value
  const last = visibleTo.value
  selection.ranges.forEach((range, i) => {
    if (isEmptyRange(range)) return
    const from = text.lineAt(rangeFrom(range))
    const to = text.lineAt(rangeTo(range))
    for (let n = Math.max(from.number, first); n <= Math.min(to.number, last); n++) {
      const str = lineText(n)
      const left = n === from.number ? measure.x(str, rangeFrom(range) - from.from) : 0
      // A selected line break shows as half a cell past the end.
      const right =
        n === to.number
          ? measure.x(str, rangeTo(range) - to.from)
          : measure.x(str, str.length) + measure.cell / 2
      if (right > left)
        out.push({ key: `s${i}-${n}`, left: PAD_X + left, top: yOf(n), width: right - left })
    }
  })
  return out
})

const activeLineTop = computed(() => {
  const n = doc.value.lineAt(mainRange(state.value.selection).head).number
  return n >= visibleFrom.value && n <= visibleTo.value ? yOf(n) : null
})
const activeLineNumber = computed(
  () => doc.value.lineAt(mainRange(state.value.selection).head).number,
)

// ---------------------------------------------------------------- the hidden textarea

/** What the textarea holds: the text from `from` to `to`, and the caret inside it. */
let mirror = { from: 0, to: 0, value: '', start: 0, end: 0 }
const inputBox = ref({ top: PAD_Y, left: PAD_X, height: 20 })

function syncInput() {
  const { doc: text, selection } = state.value
  const main = mainRange(selection)
  const first = text.lineAt(rangeFrom(main))
  const last = text.lineAt(rangeTo(main))
  let from = first.from
  let to = last.to
  // Mirror whole lines of the selection while they are short; else only around the cursor.
  if (to - from > WINDOW || last.number - first.number > 50) {
    const line = text.lineAt(main.head)
    from = Math.max(line.from, main.head - WINDOW / 2)
    to = Math.min(line.to, main.head + WINDOW / 2)
    from = line.from + snapCluster(line.text, from - line.from)
  }
  const value = text.slice(from, to)
  const start = Math.max(0, Math.min(rangeFrom(main), to) - from)
  const end = Math.max(0, Math.min(rangeTo(main), to) - from)
  mirror = { from, to, value, start, end }
  const startLine = text.lineAt(from)
  inputBox.value = {
    top: yOf(startLine.number),
    left: PAD_X + measure.x(startLine.text, from - startLine.from),
    height: (text.lineAt(to).number - startLine.number + 1) * lineHeight.value,
  }
  const el = input.value
  if (!el) return
  if (el.value !== value) el.value = value
  if (document.activeElement === el && (el.selectionStart !== start || el.selectionEnd !== end))
    el.setSelectionRange(start, end, main.head < main.anchor ? 'backward' : 'forward')
}

/** Turns what the textarea now holds into a change of the text. */
function readInput() {
  const el = input.value
  if (!el || props.readonly) return
  const diff = diffText(mirror.value, el.value, mirror.start)
  if (!diff) return
  const from = mirror.from + diff.from
  const to = mirror.from + diff.to
  const { insert } = diff
  const { doc: text, selection } = state.value
  const main = mainRange(selection)
  // Typing over the selection or at the cursor: the same goes to every cursor.
  if (from === rangeFrom(main) && to === rangeTo(main) && insert) {
    if (insert === '\n') return run(insertNewline)
    dispatch(transaction().replaceSelection(insert).setMeta({ action: 'input' }))
    return
  }
  if (!insert && isEmptyRange(main)) {
    const line = text.lineAt(main.head)
    const col = main.head - line.from
    const back = col ? line.from + moveCluster(line.text, col, -1) : main.head - 1
    const forward =
      col < line.text.length ? line.from + moveCluster(line.text, col, 1) : main.head + 1
    if (from === back && to === main.head) return run(deleteCharBackward)
    if (from === main.head && to === forward) return run(deleteCharForward)
  }
  // Anything else (autocorrect, a word recomposed): apply it as it is, and take the caret the textarea has.
  const tr = transaction().setMeta({ action: insert ? 'input' : 'delete' })
  tr.replace(from, to, insert)
  const result = tr.resolve()
  const caret = (offset: number) => mirror.from + offset
  const ranges = result.state.selection.ranges.slice()
  const backward = el.selectionDirection === 'backward'
  const head = caret(backward ? el.selectionStart : el.selectionEnd)
  const anchor = caret(backward ? el.selectionEnd : el.selectionStart)
  ranges[result.state.selection.main] = { anchor, head }
  tr.select({ ranges, main: result.state.selection.main })
  dispatch(tr)
}

function onInput() {
  if (composing.value) {
    const el = input.value!
    const diff = diffText(mirror.value, el.value, mirror.start)
    preview.value = diff
      ? { from: mirror.from + diff.from, to: mirror.from + diff.to, insert: diff.insert }
      : null
    return
  }
  readInput()
}

function onCompositionStart() {
  composing.value = true
}

function onCompositionEnd() {
  composing.value = false
  preview.value = null
  readInput()
  syncInput()
}

function onSelectionChange() {
  const el = input.value
  if (!el || document.activeElement !== el || composing.value) return
  if (el.selectionStart === mirror.start && el.selectionEnd === mirror.end) return
  if (el.value !== mirror.value) return
  // The caret moved by itself (the space bar on a phone keyboard, say): follow it.
  const backward = el.selectionDirection === 'backward'
  const start = mirror.from + el.selectionStart
  const end = mirror.from + el.selectionEnd
  const selection = state.value.selection
  const ranges = selection.ranges.slice()
  ranges[selection.main] = backward ? { anchor: end, head: start } : { anchor: start, head: end }
  mirror.start = el.selectionStart
  mirror.end = el.selectionEnd
  dispatch(transaction().select({ ranges, main: selection.main }).setMeta({ scroll: true }))
}

// ---------------------------------------------------------------- commands and keys

const target: CodeCommandTarget = {
  get state() {
    return state.value
  },
  get readonly() {
    return !!props.readonly || !!props.disabled
  },
  get tabSize() {
    return props.tabSize
  },
  get indentWithTabs() {
    return !!props.indentWithTabs
  },
  get pageLines() {
    return Math.max(1, Math.floor((viewHeight.value || 400) / lineHeight.value) - 1)
  },
  transaction,
  dispatch,
  moveVertically,
  undo,
  redo,
}

function run(command: CodeCommand) {
  return command(target)
}

function moveVertically(range: CodeRange, count: number) {
  const { doc: text } = state.value
  const line = text.lineAt(range.head)
  const goal = goals.get(range.head) ?? measure.x(line.text, range.head - line.from)
  const n = line.number + count
  let head: number
  if (n < 1) head = 0
  else if (n > text.lines) head = text.length
  else {
    const next = text.line(n)
    head = next.from + measure.col(next.text, goal)
  }
  pendingGoals.set(head, goal)
  return head
}

const keymap = computed(() => buildKeymap([...defaultKeymap, ...(props.keymap ?? [])], apple))
/** After Escape, Tab leaves the editor instead of indenting, so keyboard users are never stuck. */
let tabLeaves = false

function onKeydown(event: KeyboardEvent) {
  if (isComposing(event) || composing.value) return
  const name = eventKey(event, apple)
  const leaving = tabLeaves && (name === 'tab' || name === 'shift+tab')
  tabLeaves = name === 'escape'
  if (leaving) return
  for (const command of keymap.value.get(name) ?? []) {
    if (command(target)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }
}

function onBeforeInput(event: InputEvent) {
  // The browser's own undo would only undo the textarea's mirror.
  if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
    event.preventDefault()
    if (event.inputType === 'historyUndo') undo()
    else redo()
  }
}

// ---------------------------------------------------------------- clipboard

function selectedText() {
  const { doc: text, selection } = state.value
  return selection.ranges
    .filter((range) => !isEmptyRange(range))
    .map((range) => text.slice(rangeFrom(range), rangeTo(range)))
    .join('\n')
}

function onCopy(event: ClipboardEvent) {
  const text = selectedText()
  if (!text) return
  event.preventDefault()
  event.clipboardData?.setData('text/plain', text)
}

function onCut(event: ClipboardEvent) {
  onCopy(event)
  if (!event.defaultPrevented || target.readonly) return
  dispatch(transaction().replaceSelection('').setMeta({ action: 'cut' }))
}

function onPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text/plain')
  event.preventDefault()
  if (!text || target.readonly) return
  const { ranges } = state.value.selection
  const parts = splitLines(text)
  // One line per cursor when the counts match.
  const spread = ranges.length > 1 && parts.length === ranges.length
  dispatch(
    transaction()
      .replaceSelection(spread ? (_, i) => parts[i]! : text)
      .setMeta({ action: 'paste' }),
  )
}

// ---------------------------------------------------------------- pointer

/** The text position under a point in the page, clamped to the text. */
function posAtCoords(point: { x: number; y: number }) {
  const rect = content.value?.getBoundingClientRect()
  if (!rect) return 0
  const { doc: text } = state.value
  const n = Math.min(
    text.lines,
    Math.max(1, Math.floor((point.y - rect.top - PAD_Y - shift.value) / lineHeight.value) + 1),
  )
  const line = text.line(n)
  return line.from + measure.col(line.text, point.x - rect.left - PAD_X)
}

function coordsAtPos(pos: number) {
  const rect = content.value?.getBoundingClientRect()
  if (!rect) return null
  const line = doc.value.lineAt(pos)
  if (line.number < visibleFrom.value || line.number > visibleTo.value) return null
  const top = rect.top + yOf(line.number)
  return {
    left: rect.left + PAD_X + measure.x(line.text, pos - line.from),
    top,
    bottom: top + lineHeight.value,
  }
}

type Unit = 'char' | 'word' | 'line'

/** The span of one unit around a position: itself, its word or its whole line. */
function unitAt(pos: number, unit: Unit) {
  if (unit === 'char') return { from: pos, to: pos }
  const line = doc.value.lineAt(pos)
  if (unit === 'line') return { from: line.from, to: Math.min(doc.value.length, line.to + 1) }
  const word = wordAt(line.text, pos - line.from)
  return { from: line.from + word.from, to: line.from + word.to }
}

let drag: {
  unit: Unit
  start: { from: number; to: number }
  x: number
  y: number
  frame: number
  hold: ReturnType<typeof holdPointer>
} | null = null

function extendTo(point: { x: number; y: number }) {
  if (!drag) return
  const pos = posAtCoords(point)
  const at = unitAt(pos, drag.unit)
  const { start } = drag
  const range =
    at.from < start.from
      ? { anchor: start.to, head: at.from }
      : { anchor: start.from, head: Math.max(at.to, start.to) }
  if (drag.unit === 'char') {
    range.anchor = start.from
    range.head = pos
  }
  const selection = state.value.selection
  const ranges = selection.ranges.slice()
  ranges[selection.main] = range
  dispatch(transaction().select({ ranges, main: selection.main }).setMeta({ scroll: false }))
}

/** Scrolls while a drag is held past the top or bottom edge. */
function autoScroll() {
  if (!drag || !scroller.value) return
  const rect = scroller.value.getBoundingClientRect()
  const dy = drag.y < rect.top ? drag.y - rect.top : drag.y > rect.bottom ? drag.y - rect.bottom : 0
  const dx =
    drag.x < rect.left + gutterWidth.value
      ? drag.x - rect.left - gutterWidth.value
      : drag.x > rect.right
        ? drag.x - rect.right
        : 0
  if (dy || dx) {
    scroller.value.scrollTop += dy / 2
    scroller.value.scrollLeft += dx / 2
    onScroll()
    extendTo(drag)
  }
  drag.frame = requestAnimationFrame(autoScroll)
}

function startDrag(event: PointerEvent, unit: Unit, start: { from: number; to: number }) {
  drag = {
    unit,
    start,
    x: event.clientX,
    y: event.clientY,
    frame: 0,
    hold: holdPointer(event, root.value),
  }
  drag.hold.grab()
  drag.frame = requestAnimationFrame(autoScroll)
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

function onDragMove(event: PointerEvent) {
  if (!drag) return
  drag.x = event.clientX
  drag.y = event.clientY
  extendTo(drag)
}

function endDrag() {
  if (!drag) return
  cancelAnimationFrame(drag.frame)
  drag.hold.release()
  drag = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

function focusInput() {
  if (props.disabled) return
  input.value?.focus({ preventScroll: true })
}

function select(unit: Unit, pos: number, extend: boolean) {
  const at = unitAt(pos, unit)
  const main = mainRange(state.value.selection)
  const range = extend
    ? { anchor: main.anchor, head: pos < main.anchor ? at.from : at.to }
    : { anchor: at.from, head: at.to }
  dispatch(
    transaction()
      .select({ ranges: [range], main: 0 })
      .setMeta({ scroll: false }),
  )
  // A drag goes on from the anchor kept by Shift, or from the unit pressed.
  return extend ? { from: main.anchor, to: main.anchor } : at
}

/** A tap that may turn into a scroll or a long press; touches only act once they end in place. */
let touch: { x: number; y: number; timer: number; pointer: number; pressed: boolean } | null = null

function onPointerDown(event: PointerEvent, area: 'text' | 'gutter') {
  if (event.button !== 0 || props.disabled) return
  const pos = posAtCoords({ x: event.clientX, y: event.clientY })
  if (event.pointerType !== 'mouse') {
    const x = event.clientX
    const y = event.clientY
    touch = {
      x,
      y,
      pointer: event.pointerId,
      pressed: false,
      // A long press selects the word under the finger.
      timer: window.setTimeout(() => {
        if (!touch) return
        touch.pressed = true
        select(area === 'gutter' ? 'line' : 'word', pos, false)
        focusInput()
      }, 450),
    }
    return
  }
  event.preventDefault()
  focusInput()
  const unit: Unit =
    area === 'gutter' ? 'line' : event.detail >= 3 ? 'line' : event.detail === 2 ? 'word' : 'char'
  startDrag(event, unit, select(unit, pos, event.shiftKey))
}

function onPointerMove(event: PointerEvent) {
  if (!touch || event.pointerId !== touch.pointer) return
  if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 8) {
    clearTimeout(touch.timer)
    touch = null
  }
}

function onPointerUp(event: PointerEvent, area: 'text' | 'gutter') {
  if (!touch || event.pointerId !== touch.pointer) return
  clearTimeout(touch.timer)
  const pressed = touch.pressed
  touch = null
  if (pressed) return
  const pos = posAtCoords({ x: event.clientX, y: event.clientY })
  select(area === 'gutter' ? 'line' : 'char', pos, false)
  focusInput()
}

function onPointerCancel() {
  if (touch) clearTimeout(touch.timer)
  touch = null
}

// ---------------------------------------------------------------- scrolling

function onScroll() {
  const el = scroller.value
  if (!el) return
  scrollTop.value = el.scrollTop
  updateClip()
}

/** Keeps a position in view, with a line of room around it. */
function scrollIntoView(pos = mainRange(state.value.selection).head) {
  const el = scroller.value
  if (!el) return
  const line = doc.value.lineAt(pos)
  const lh = lineHeight.value
  const view = el.clientHeight
  if (view < lh * 3) return
  const y = PAD_Y + (line.number - 1) * lh
  const top = el.scrollTop * ratio.value
  const margin = Math.min(lh, view / 4)
  if (y - margin < top) el.scrollTop = Math.max(0, (y - margin) / ratio.value)
  else if (y + lh + margin > top + view) el.scrollTop = (y + lh + margin - view) / ratio.value
  const x = PAD_X + measure.x(line.text, pos - line.from)
  const width = el.clientWidth - gutterWidth.value
  if (x - measure.cell * 2 < el.scrollLeft) el.scrollLeft = Math.max(0, x - measure.cell * 4)
  else if (x + measure.cell * 2 > el.scrollLeft + width)
    el.scrollLeft = x + measure.cell * 4 - width
  onScroll()
}

let clipFrame = 0
/** For an editor taller than the window, draws only the lines inside the window. */
function updateClip() {
  const el = scroller.value
  if (!el) return
  if (el.clientHeight <= window.innerHeight) {
    if (clip.value) clip.value = null
    return
  }
  const rect = el.getBoundingClientRect()
  const top = Math.max(0, -rect.top)
  const bottom = Math.max(top, Math.min(el.clientHeight, window.innerHeight - rect.top))
  if (clip.value?.top !== top || clip.value?.bottom !== bottom) clip.value = { top, bottom }
}
function onWindowScroll(event: Event) {
  if (event.target === scroller.value || clipFrame) return
  clipFrame = requestAnimationFrame(() => {
    clipFrame = 0
    updateClip()
  })
}

let resize: ResizeObserver | undefined
function refreshMetrics() {
  measure.refresh(props.tabSize)
  metrics.value++
  syncInput()
}

watch(
  () => props.tabSize,
  () => refreshMetrics(),
)

onMounted(() => {
  refreshMetrics()
  const el = scroller.value!
  viewHeight.value = el.clientHeight
  viewWidth.value = el.clientWidth
  if (typeof ResizeObserver !== 'undefined') {
    resize = new ResizeObserver(() => {
      viewHeight.value = el.clientHeight
      viewWidth.value = el.clientWidth
      updateClip()
    })
    resize.observe(el)
  }
  updateClip()
  window.addEventListener('scroll', onWindowScroll, { capture: true, passive: true })
  window.addEventListener('resize', onWindowScroll, { passive: true })
  document.addEventListener('selectionchange', onSelectionChange)
  // Web fonts change the cell width once they arrive.
  document.fonts?.ready.then(() => root.value && refreshMetrics())
  document.fonts?.addEventListener?.('loadingdone', refreshMetrics)
  if (props.autofocus) focusInput()
})

onBeforeUnmount(() => {
  resize?.disconnect()
  endDrag()
  onPointerCancel()
  cancelAnimationFrame(clipFrame)
  window.removeEventListener('scroll', onWindowScroll, { capture: true })
  window.removeEventListener('resize', onWindowScroll)
  document.removeEventListener('selectionchange', onSelectionChange)
  document.fonts?.removeEventListener?.('loadingdone', refreshMetrics)
})

function onFocus(event: FocusEvent) {
  focused.value = true
  syncInput()
  emit('focus', event)
}

function onBlur(event: FocusEvent) {
  focused.value = false
  history.close()
  if (lazyDirty) {
    lazyDirty = false
    emit('update:modelValue', textOf(doc.value))
  }
  emit('blur', event)
}

defineExpose<CodeEditorExpose>({
  get state() {
    return state.value
  },
  get doc() {
    return state.value.doc
  },
  get selection() {
    return state.value.selection
  },
  transact,
  run,
  undo,
  redo,
  get canUndo() {
    void historyTick.value
    return history.canUndo
  },
  get canRedo() {
    void historyTick.value
    return history.canRedo
  },
  select(anchor, head) {
    const selection = typeof anchor === 'number' ? selectionOf(anchor, head) : anchor
    dispatch(
      transaction()
        .select(normalizeSelection(selection, doc.value.length))
        .setMeta({ scroll: true }),
    )
  },
  scrollIntoView,
  coordsAtPos,
  posAtCoords,
  focus: focusInput,
  blur: () => input.value?.blur(),
})
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      ns.is('focused', focused),
      ns.is('readonly', !!readonly),
      ns.is('disabled', !!disabled),
    ]"
    :style="{
      '--dou-code-editor-gutter': `${gutterWidth}px`,
      '--dou-code-editor-tab-size': tabSize,
    }"
  >
    <div ref="scroller" :class="ns.e('scroller')" @scroll.passive="onScroll">
      <div
        :class="ns.e('sizer')"
        :style="{
          height: `${sizerHeight}px`,
          minWidth: `max(100%, ${contentWidth + gutterWidth}px)`,
        }"
      >
        <div
          v-if="lineNumbers"
          :class="ns.e('gutter')"
          aria-hidden="true"
          @pointerdown="onPointerDown($event, 'gutter')"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp($event, 'gutter')"
          @pointercancel="onPointerCancel"
          @mousedown.prevent
        >
          <div :class="ns.e('numbers')" :style="{ transform: `translateY(${yOf(visibleFrom)}px)` }">
            <div
              v-for="row in rows"
              :key="row.n"
              :class="[ns.e('number'), ns.is('active', row.n === activeLineNumber)]"
            >
              {{ row.n }}
            </div>
          </div>
        </div>
        <div
          ref="content"
          :class="ns.e('content')"
          @pointerdown="onPointerDown($event, 'text')"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp($event, 'text')"
          @pointercancel="onPointerCancel"
          @mousedown.prevent
        >
          <div ref="probe" :class="ns.e('probe')" aria-hidden="true" />
          <div
            v-if="activeLine && activeLineTop !== null && !disabled"
            :class="ns.e('active-line')"
            :style="{ transform: `translateY(${activeLineTop}px)` }"
          />
          <div :class="ns.e('selections')" aria-hidden="true">
            <div
              v-for="box in selectionBoxes"
              :key="box.key"
              :class="ns.e('selection')"
              :style="{
                transform: `translate(${box.left}px, ${box.top}px)`,
                width: `${box.width}px`,
              }"
            />
          </div>
          <div
            :class="ns.e('lines')"
            aria-hidden="true"
            :style="{ transform: `translateY(${yOf(visibleFrom)}px)` }"
          >
            <div
              v-for="row in rows"
              :key="row.n"
              v-memo="[row.text, row.compose?.join('\u0000')]"
              :class="ns.e('line')"
            >
              <template v-if="row.compose"
                >{{ row.compose[0] }}<span :class="ns.e('compose')">{{ row.compose[1] }}</span
                >{{ row.compose[2] }}</template
              >
              <template v-else>{{ row.text }}</template>
            </div>
          </div>
          <div
            v-if="placeholder && !doc.length && !composing"
            :class="ns.e('placeholder')"
            aria-hidden="true"
          >
            {{ placeholder }}
          </div>
          <div v-if="focused" :key="blink" :class="ns.e('cursors')" aria-hidden="true">
            <div
              v-for="cursor in cursors"
              :key="cursor.key"
              :class="ns.e('cursor')"
              :style="{ transform: `translate(${cursor.left - 1}px, ${cursor.top}px)` }"
            />
          </div>
          <textarea
            ref="input"
            :class="ns.e('input')"
            :style="{
              top: `${inputBox.top}px`,
              left: `${inputBox.left}px`,
              height: `${inputBox.height}px`,
            }"
            :aria-label="ariaLabel"
            :aria-placeholder="placeholder || undefined"
            :readonly="readonly"
            :disabled="disabled"
            wrap="off"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="enter"
            @keydown="onKeydown"
            @beforeinput="onBeforeInput"
            @input="onInput"
            @compositionstart="onCompositionStart"
            @compositionend="onCompositionEnd"
            @copy="onCopy"
            @cut="onCut"
            @paste="onPaste"
            @focus="onFocus"
            @blur="onBlur"
          />
        </div>
      </div>
    </div>
  </div>
</template>
