<script setup lang="ts">
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InfoIcon,
  LightbulbIcon,
  XCircleIcon,
} from '@dou-ui/icons'
import { holdPointer, isApplePlatform, isComposing, useNamespace, useZIndex } from 'dou-ui'
import {
  computed,
  getCurrentInstance,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  toRaw,
  watch,
} from 'vue'
import { matchBracket } from './core/brackets'
import { ChangeSet } from './core/changes'
import { moveCluster, snapCluster, wordAt } from './core/chars'
import type { CodeCommand, CodeCommandTarget } from './core/commands'
import {
  deleteCharBackward,
  deleteCharForward,
  insertNewline,
  insertText,
  selectAll,
} from './core/commands'
import { type CodeFold, foldEndAt, hiddenLines } from './core/folding'
import { CodeHistory } from './core/history'
import { type CodeKeyBinding, buildKeymap, defaultKeymap, eventKey } from './core/keymap'
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
import {
  type CodeMatch,
  type CodeSearchQuery,
  matchAfter,
  replacementFor,
  searchText,
} from './core/search'
import { CodeHighlighter } from './language/highlighter'
import { format, useCodeMessages } from './locale'
import CodeKeys from './code-keys.vue'
import {
  CODE_EDITOR_KEY,
  type CodeDecoration,
  type CodeDiagnostic,
  type CodeDiagnosticSeverity,
  type CodeExtension,
  type CodeExtensionContext,
  type CodeGutterMarker,
  type CodePanel,
} from './extension'
import RenderPart from './render-part'
import SearchPanel from './search-panel.vue'
import { type CodeLineTokens, type CodeTokenType, lineParts, tokenTypes } from './language/language'
import type { CodeEditorEmits, CodeEditorExpose, CodeEditorProps } from './types'
import { diffText } from './view/input'
import {
  LineLayout,
  UNWRAPPED,
  type WrappedLine,
  rowOfCol,
  updateRows,
  wrapLine,
} from './view/layout'
import { Measure } from './view/measure'

defineOptions({ name: 'DouCodeEditor' })

const props = withDefaults(defineProps<CodeEditorProps>(), {
  modelValue: undefined,
  doc: undefined,
  selection: undefined,
  lineNumbers: true,
  activeLine: true,
  tabSize: 2,
  language: undefined,
  closeBrackets: true,
  matchBrackets: true,
  searchable: true,
  wrap: false,
  foldable: true,
  keys: true,
  messages: undefined,
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

/** The last press was a finger: the selection gets handles, and a toolbar over it. */
const touchUi = ref(false)
/** A handle under a lone cursor, shown after a tap until the text changes. */
const caretHandle = ref(false)
/** The toolbar over the selection (cut, copy, paste, select all). */
const menuOpen = ref(false)
/** A finger drags a handle or a long-pressed selection: the magnifier shows. */
const touchDrag = ref(false)

function dispatch(tr: CodeTransaction): CodeTransactionResult | null {
  const { action } = tr.meta
  if (action !== 'undo' && action !== 'redo' && action !== 'external')
    for (const extension of extensions.value) extension.transaction?.(tr, context)
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
  if (!result.changes.empty) {
    highlighter?.update(result.state.doc, result.changes)
    mapMatches(result.changes)
    updateWrap(before.doc, result.state.doc, result.changes)
    mapFolds(result.changes, result.state.doc)
    mapDiagnostics(result.changes, result.state.doc)
    scheduleLint()
  }
  state.value = markRaw(result.state)
  revealFolds()
  problemBox.value = null
  // The toolbar is for the selection it opened on; typing also puts away the handle under a lone cursor.
  menuOpen.value = false
  if (!result.changes.empty) caretHandle.value = false
  goals = pendingGoals
  pendingGoals = new Map()
  blink.value++
  if (!composing.value) syncInput()
  emitChange(result)
  if (result.meta.scroll ?? !result.changes.empty)
    nextTick(() => {
      scrollIntoView()
      if (touchUi.value) followViewport()
    })
  return result
}

const transaction = () => new CodeTransaction(state.value)

// ---------------------------------------------------------------- extensions

/** The extensions, highest priority first. */
const extensions = computed<CodeExtension[]>(() =>
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  (props.extensions ?? []).slice().sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100)),
)
/** What extensions see; the same object as the instance, made once the instance is. */
let context: CodeExtensionContext

/** Problems by who found them (`prop` for the prop, else the extension's name), moved with every edit. */
const diagnosticSets = shallowRef(new Map<string, CodeDiagnostic[]>())
const SEVERITY_RANK: Record<CodeDiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
  hint: 3,
}

const diagnostics = computed<readonly CodeDiagnostic[]>(() => {
  const all: CodeDiagnostic[] = []
  for (const list of diagnosticSets.value.values()) all.push(...list)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  return all.sort(
    (a, b) => a.from - b.from || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )
})

function setDiagnostics(key: string, list: readonly CodeDiagnostic[] | null | undefined) {
  const length = doc.value.length
  const next = new Map(diagnosticSets.value)
  const clean = (list ?? []).map((d) => {
    const from = Math.max(0, Math.min(length, Math.min(d.from, d.to)))
    return { ...d, from, to: Math.max(from, Math.min(length, Math.max(d.from, d.to))) }
  })
  if (clean.length) next.set(key, clean)
  else if (!next.has(key)) return
  else next.delete(key)
  diagnosticSets.value = next
}

/** Moves the problems along with an edit; one whose text was all deleted shrinks to where it was. */
function mapDiagnostics(changes: ChangeSet, after: CodeText) {
  if (!diagnosticSets.value.size) return
  const next = new Map<string, CodeDiagnostic[]>()
  for (const [key, list] of diagnosticSets.value)
    next.set(
      key,
      list.map((d) => {
        const from = Math.min(after.length, changes.mapPos(d.from, 1))
        return { ...d, from, to: Math.max(from, Math.min(after.length, changes.mapPos(d.to, -1))) }
      }),
    )
  diagnosticSets.value = next
}

watch(
  () => props.diagnostics,
  (list) => setDiagnostics('prop', list),
  { immediate: true },
)

/** Runs the linters a moment after the text stops changing. */
const LINT_DELAY = 300
let lintTimer = 0
const linting = computed(() => extensions.value.some((extension) => extension.lint))

function runLint() {
  clearTimeout(lintTimer)
  const text = doc.value
  for (const extension of extensions.value) {
    if (!extension.lint) continue
    let found: ReturnType<NonNullable<CodeExtension['lint']>>
    try {
      found = extension.lint(context)
    } catch (error) {
      console.error(`[DouCodeEditor] ${extension.name}: lint failed`, error)
      continue
    }
    // A linter that answers at once is shown at once, without a frame of old problems.
    if (!found || !('then' in found)) {
      setDiagnostics(extension.name, found)
      continue
    }
    Promise.resolve(found)
      .then((list) => {
        // Found in a text that has changed since: the next run follows.
        if (doc.value === text) setDiagnostics(extension.name, list)
      })
      .catch((error: unknown) =>
        console.error(`[DouCodeEditor] ${extension.name}: lint failed`, error),
      )
  }
}

function scheduleLint() {
  if (!linting.value || !mounted.value) return
  clearTimeout(lintTimer)
  lintTimer = window.setTimeout(runLint, LINT_DELAY)
}

watch(extensions, (next, before) => {
  // A linter that went away takes its problems with it.
  for (const gone of before ?? []) if (!next.includes(gone)) setDiagnostics(gone.name, [])
  if (mounted.value) runLint()
})

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
    if (given) {
      highlighter?.update(given, ChangeSet.of([], given.length))
      state.value = markRaw({ ...state.value, doc: given })
      if (wrapRows) rebuildWrap()
    }
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
  highlighter?.update(result.state.doc, result.changes)
  updateWrap(result.before.doc, result.state.doc, result.changes)
  mapFolds(result.changes, result.state.doc)
  mapDiagnostics(result.changes, result.state.doc)
  problemBox.value = null
  scheduleLint()
  state.value = markRaw(result.state)
  mapMatches(result.changes)
  menuOpen.value = false
  caretHandle.value = false
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

const mounted = ref(false)
const scrollTop = ref(0)
const scrollLeft = ref(0)
const viewHeight = ref(0)
const viewWidth = ref(0)
/** The part of the scroller that is inside the window, for an editor taller than the page. */
const clip = ref<{ top: number; bottom: number } | null>(null)

const lineHeight = computed(() => {
  void metrics.value
  return measure.lineHeight
})

// ---------------------------------------------------------------- wrapping and folding

/** The width a row of text may take when wrapping; 0 when lines don't wrap. */
const wrapWidth = computed(() => {
  // Cut nothing before the editor knows its width.
  if (!props.wrap || !mounted.value) return 0
  void metrics.value
  const width = viewWidth.value - gutterWidth.value - PAD_X * 2 - measure.cell
  return Math.max(measure.cell * 8, width)
})
/** How each line text is cut at the current width; texts repeat (blank lines, braces), so this is by text. */
let wrapCache = new Map<string, WrappedLine>()
/** Rows of each line while wrapping (index `n - 1`), kept in step with edits. */
let wrapRows: number[] | null = null
/** Bumped when `wrapRows` changes without the text changing. */
const layoutTick = ref(0)

function wrapOf(text: string): WrappedLine {
  const width = wrapWidth.value
  if (!width || text.length * measure.cell <= width / 2) return UNWRAPPED
  let wrapped = wrapCache.get(text)
  if (!wrapped) {
    if (wrapCache.size > 20_000) wrapCache = new Map()
    wrapped = wrapLine(text, width, measure)
    wrapCache.set(text, wrapped)
  }
  return wrapped
}

const rowsOfText = (text: string) => wrapOf(text).breaks.length + 1

function rebuildWrap() {
  wrapCache = new Map()
  wrapRows = wrapWidth.value ? doc.value.lineTexts(1, doc.value.lines).map(rowsOfText) : null
  layoutTick.value++
}

/** Moves the wrapped rows along with an edit, cutting again only the lines it touched. */
function updateWrap(before: CodeText, after: CodeText, changes: ChangeSet) {
  if (!wrapRows) return
  if (!updateRows(wrapRows, before, after, changes, rowsOfText)) rebuildWrap()
}

const folds = shallowRef<CodeFold[]>([])
const NOTHING_HIDDEN: Array<[number, number]> = []
const hidden = computed(() =>
  folds.value.length ? hiddenLines(doc.value, folds.value) : NOTHING_HIDDEN,
)
const layout = computed<LineLayout>((previous) => {
  void layoutTick.value
  const lines = doc.value.lines
  const rows = wrapRows && wrapRows.length === lines ? wrapRows : null
  // One row per line and the same count: the same layout, so nothing drawn from it is worked out again.
  if (!rows && !hidden.value.length && previous?.uniform && previous.lines === lines)
    return previous
  return markRaw(new LineLayout(lines, rows, hidden.value))
})

const total = computed(() => layout.value.total * lineHeight.value)
const sizerHeight = computed(() => Math.min(total.value, MAX_HEIGHT) + PAD_Y * 2)
/** How much faster than the scrollbar the text moves, above `MAX_HEIGHT`. */
const ratio = computed(() => {
  if (total.value <= MAX_HEIGHT) return 1
  const view = viewHeight.value || 1
  return Math.max(1, (total.value - view) / Math.max(1, MAX_HEIGHT - view))
})
/** Offset between the text's own y and where it is drawn in the scaled scroller. */
const shift = computed(() => scrollTop.value - scrollTop.value * ratio.value)
/** The y line `n` is drawn at. */
const yOf = (line: number) => PAD_Y + layout.value.rowOf(line) * lineHeight.value + shift.value
/** The row under a y in the content, from the text's top. */
const rowAtY = (y: number) => Math.floor((y - PAD_Y - shift.value) / lineHeight.value)

const visibleFrom = computed(() => {
  const top = scrollTop.value * ratio.value + (clip.value?.top ?? 0)
  const row = Math.floor((top - PAD_Y) / lineHeight.value) - OVERSCAN
  return layout.value.lineAtRow(Math.max(0, row)).n
})
const visibleTo = computed(() => {
  const bottom = scrollTop.value * ratio.value + (clip.value?.bottom ?? viewHeight.value)
  const row = Math.ceil((bottom - PAD_Y) / lineHeight.value) + OVERSCAN
  return layout.value.lineAtRow(row).n
})

/** The lines in view that are drawn (folded ones left out), with their text; read in runs, once per frame. */
const shownLines = computed(() => {
  const from = visibleFrom.value
  const to = visibleTo.value
  const text = doc.value
  const numbers: number[] = []
  const texts: string[] = []
  let n = from
  for (const [a, b] of hidden.value) {
    if (b < n) continue
    if (a > to) break
    if (a > n) {
      const chunk = text.lineTexts(n, a - 1)
      for (let i = 0; i < chunk.length; i++) numbers.push(n + i)
      texts.push(...chunk)
    }
    n = Math.max(n, b + 1)
  }
  if (n <= to) {
    const chunk = text.lineTexts(n, to)
    for (let i = 0; i < chunk.length; i++) numbers.push(n + i)
    texts.push(...chunk)
  }
  return { numbers, texts }
})
const lines = computed(() => shownLines.value.texts)
/** A line's text, from the lines in view when it is one of them. */
function lineText(n: number) {
  const { numbers, texts } = shownLines.value
  let lo = 0
  let hi = numbers.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (numbers[mid] === n) return texts[mid]!
    if (numbers[mid]! < n) lo = mid + 1
    else hi = mid - 1
  }
  return doc.value.line(n).text
}
const isShown = (n: number) =>
  n >= visibleFrom.value && n <= visibleTo.value && layout.value.shown(n)

/** Where column `col` of line `n` is drawn: the row's top, the x from the text's left edge, and which row of the line. */
function place(n: number, text: string, col: number) {
  const wrapped = wrapOf(text)
  const sub = rowOfCol(wrapped, col)
  const top = yOf(n) + sub * lineHeight.value
  if (!sub) return { top, x: measure.x(text, col), sub }
  return {
    top,
    x: wrapped.indent + measure.x(text, col) - measure.x(text, wrapped.breaks[sub - 1]!),
    sub,
  }
}

/** The column nearest to `x` on row `sub` of a line. */
function colAt(text: string, sub: number, x: number) {
  const wrapped = wrapOf(text)
  const { breaks } = wrapped
  if (!breaks.length) return measure.col(text, x)
  const start = sub ? breaks[sub - 1]! : 0
  const end = sub < breaks.length ? breaks[sub]! : text.length
  const base = measure.x(text, start)
  const col = measure.col(text, base + Math.max(0, x - (sub ? wrapped.indent : 0)))
  // The end of a row that isn't the last is the start of the next one; stay on this row.
  if (sub < breaks.length && col >= end) return Math.max(start, moveCluster(text, end, -1))
  return Math.max(start, col)
}

/** Boxes over columns `from` to `to` of line `n`, one per row; `tail` adds width past the line's end. */
function spans(n: number, text: string, from: number, to: number, tail = 0) {
  const wrapped = wrapOf(text)
  const out: Array<{ top: number; left: number; width: number }> = []
  const rows = wrapped.breaks.length + 1
  const top = yOf(n)
  for (let sub = 0; sub < rows; sub++) {
    const start = sub ? wrapped.breaks[sub - 1]! : 0
    const end = sub < rows - 1 ? wrapped.breaks[sub]! : text.length
    if (to < start || from > end || (from === end && sub < rows - 1)) continue
    const a = Math.max(from, start)
    const b = Math.min(to, end)
    const base = sub ? wrapped.indent - measure.x(text, start) : 0
    const left = base + measure.x(text, a)
    const right = base + measure.x(text, b) + (sub === rows - 1 ? tail : 0)
    if (right > left) out.push({ top: top + sub * lineHeight.value, left, width: right - left })
  }
  return out
}

const SEVERITY_ICON = {
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
  hint: LightbulbIcon,
} as const

/** Columns left of the line numbers: the problems' column, then the extensions' own. */
const gutterColumns = computed(() => {
  const columns: Array<{
    name: string
    width: number
    markers: () => CodeGutterMarker[]
    onPress?: (line: number, event: PointerEvent) => void
  }> = []
  // Kept while anything may report problems, so the text doesn't jump when the first one comes.
  if (props.diagnostics !== undefined || linting.value || diagnostics.value.length)
    columns.push({ name: 'problems', width: 16, markers: problemMarkers })
  for (const extension of extensions.value)
    for (const gutter of extension.gutters ?? [])
      columns.push({
        name: gutter.name,
        width: gutter.width ?? 16,
        markers: () => gutter.markers(context),
        onPress: gutter.onPress && ((line, event) => gutter.onPress!(line, event, context)),
      })
  return columns
})
const gutterCells = computed(() =>
  gutterColumns.value.reduce((sum, column) => sum + column.width, 0),
)

/** The worst problem on each line in view, as a marker. */
function problemMarkers(): CodeGutterMarker[] {
  const text = doc.value
  const first = visibleFrom.value
  const last = visibleTo.value
  const end = text.line(last).to
  const worst = new Map<number, CodeDiagnostic>()
  for (const problem of diagnostics.value) {
    if (problem.from > end) break
    const n = text.lineAt(problem.from).number
    if (n < first) continue
    const had = worst.get(n)
    if (!had || SEVERITY_RANK[problem.severity] < SEVERITY_RANK[had.severity]) worst.set(n, problem)
  }
  const m = messages.value
  return [...worst].map(([line, problem]) => ({
    line,
    icon: SEVERITY_ICON[problem.severity],
    class: `dou-code-editor__problem-icon is-${problem.severity}`,
    title: `${m[problem.severity]}：${problem.message}`,
  }))
}

/** The markers of each column, by line, for the lines in view. */
const gutterMarkers = computed(() =>
  gutterColumns.value.map((column) => {
    const byLine = new Map<number, CodeGutterMarker>()
    for (const marker of column.markers()) byLine.set(marker.line, marker)
    return byLine
  }),
)

const gutterWidth = computed(() => {
  const cells = gutterCells.value
  if (!props.lineNumbers && !props.foldable && !cells) return 0
  void metrics.value
  const digits = Math.max(2, String(doc.value.lines).length)
  const numbers = props.lineNumbers ? Math.ceil(digits * measure.cell) + 28 : 12
  return cells + numbers + (props.foldable ? 14 : 0)
})

const contentWidth = computed(() => {
  if (props.wrap) return 0
  void metrics.value
  let widest = doc.value.widest * measure.cell
  for (const text of lines.value) {
    if (text.length * measure.cell * 2 < widest) continue
    widest = Math.max(widest, measure.x(text, text.length))
  }
  return Math.ceil(widest + PAD_X * 2 + measure.cell)
})

watch(wrapWidth, rebuildWrap, { immediate: true })

// ---------------------------------------------------------------- folding

/**
 * Where a fold starting at line `n` would end, or `null`; by brackets with a
 * language, else by indentation. Brackets in strings and comments count
 * only where the text has been read already, so folding a whole long text
 * doesn't read all of it first.
 */
function foldEnd(n: number) {
  const text = doc.value
  const hl = highlighter
  const read = !!hl?.ready(n)
  const language = props.language
    ? ((read ? languageAt(text.line(n).from) : null) ?? props.language)
    : null
  return foldEndAt(text, n, {
    brackets: language?.brackets,
    tabSize: props.tabSize,
    skip: read
      ? (pos) => {
          const kind = syntaxAt(pos)
          return kind === 'string' || kind === 'comment'
        }
      : undefined,
  })
}

/** The lines that start a fold, from 1. */
const foldStarts = computed(() => folds.value.map((fold) => doc.value.lineAt(fold.from).number))
watch(foldStarts, (next, prev) => {
  if (next.length !== prev.length || next.some((n, i) => n !== prev[i])) emit('fold-change', next)
})

function setFolds(next: CodeFold[]) {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  folds.value = next.slice().sort((a, b) => a.from - b.from)
}

/** Moves the folds along with an edit; a fold whose lines were joined goes away. */
function mapFolds(changes: ChangeSet, after: CodeText) {
  if (!folds.value.length) return
  setFolds(
    folds.value
      .map((fold) => ({ from: changes.mapPos(fold.from, 1), to: changes.mapPos(fold.to, -1) }))
      .filter((fold) => after.lineAt(fold.to).number > after.lineAt(fold.from).number),
  )
}

/** Unfolds whatever hides a cursor, so the cursor is never out of sight. */
function revealFolds() {
  if (!folds.value.length) return
  const heads = state.value.selection.ranges.map((range) => range.head)
  const keep = folds.value.filter((fold) => !heads.some((h) => h > fold.from && h <= fold.to))
  if (keep.length !== folds.value.length) folds.value = keep
}

/** Folds the block starting at line `n`; cursors inside move to its first line. */
function foldLine(n: number) {
  const end = foldEnd(n)
  if (end === null) return false
  const text = doc.value
  const fold = { from: text.line(n).to, to: text.line(end).to }
  if (folds.value.some((f) => f.from === fold.from)) return false
  const { selection } = state.value
  if (selection.ranges.some((range) => range.head > fold.from && range.head <= fold.to)) {
    const ranges = selection.ranges.map((range) =>
      range.head > fold.from && range.head <= fold.to
        ? { anchor: fold.from, head: fold.from }
        : range,
    )
    dispatch(
      transaction().select(normalizeSelection({ ranges, main: selection.main }, text.length)),
    )
  }
  setFolds([...folds.value, fold])
  announce(format(messages.value.folded, { from: n + 1, to: end }))
  return true
}

/** Reads a fold out; the same words twice in a row are read again. */
function announce(text: string) {
  announcement.value = announcement.value === text ? `${text}\u200b` : text
}

const folding = {
  fold(line?: number) {
    if (!props.foldable) return false
    const text = doc.value
    const n = line ?? text.lineAt(mainRange(state.value.selection).head).number
    if (line !== undefined) return foldLine(n)
    // The block that starts here, or else the nearest one above that reaches down to here.
    for (let k = n; k >= Math.max(1, n - 2000); k--) {
      const end = foldEnd(k)
      if (end !== null && (k === n || end >= n) && foldLine(k)) return true
    }
    return false
  },
  unfold(line?: number) {
    const text = doc.value
    const n = line ?? text.lineAt(mainRange(state.value.selection).head).number
    const keep = folds.value.filter((fold) => {
      const from = text.lineAt(fold.from).number
      return n < from || n > text.lineAt(fold.to).number
    })
    if (keep.length === folds.value.length) return false
    folds.value = keep
    announce(messages.value.unfolded)
    return true
  },
  foldAll() {
    if (!props.foldable) return false
    const text = doc.value
    const next: CodeFold[] = []
    for (let n = 1; n < text.lines; n++) {
      const end = foldEnd(n)
      if (end === null) continue
      next.push({ from: text.line(n).to, to: text.line(end).to })
      n = end
    }
    if (!next.length) return false
    setFolds(next)
    announce(messages.value.foldedAll)
    // Cursors that ended up hidden go to the top of their block.
    const { selection } = state.value
    const ranges = selection.ranges.map((range) => {
      const fold = next.find((f) => range.head > f.from && range.head <= f.to)
      return fold ? { anchor: fold.from, head: fold.from } : range
    })
    dispatch(
      transaction().select(normalizeSelection({ ranges, main: selection.main }, text.length)),
    )
    return true
  },
  unfoldAll() {
    if (!folds.value.length) return false
    folds.value = []
    announce(messages.value.unfoldedAll)
    return true
  },
}

/** Whether lines in view start a block, worked out only while the gutter is pointed at (or on touch screens). */
const gutterHover = ref(false)
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
let foldCache = { doc: null as CodeText | null, ends: new Map<number, number | null>() }
const foldableLines = computed(() => {
  const out = new Set<number>()
  if (!props.foldable || !(gutterHover.value || coarse)) return out
  void syntaxTick.value
  if (foldCache.doc !== doc.value) foldCache = { doc: doc.value, ends: new Map() }
  for (const n of shownLines.value.numbers) {
    let end = foldCache.ends.get(n)
    if (end === undefined) {
      end = foldEnd(n)
      foldCache.ends.set(n, end)
    }
    if (end !== null) out.add(n)
  }
  return out
})

function toggleFold(n: number, folded: boolean) {
  if (folded) folding.unfold(n)
  else folding.fold(n)
}

// ---------------------------------------------------------------- composition

const composing = ref(false)
/** What the input method shows while composing: a replacement of the text, drawn but not applied yet. */
const preview = shallowRef<{ from: number; to: number; insert: string } | null>(null)

/** A class over part of a line, `from`–`to` in the line, with a title shown on hover. */
type Mark = [from: number, to: number, cls: string, title?: string]

interface Row {
  n: number
  text: string
  /** How the line is cut into rows, when it wraps. */
  wrapped: WrappedLine
  /** The line starts a fold. */
  folded: boolean
  /** The line's tokens, when its language has read it; kept the same while the line doesn't change. */
  tokens: CodeLineTokens | null
  /** Set on the line being composed: the text drawn before, inside and after the composition. */
  compose?: [before: string, insert: string, after: string]
  /** Classes on parts of the line, from decorations and problems: `[from, to, class, title]` in the line. */
  marks?: Mark[]
  /** The same, as one string, to tell when they changed. */
  marksKey?: string
  /** Classes on the whole line, from decorations. */
  lineClass?: string
}

const rows = computed<Row[]>(() => {
  const { numbers, texts } = shownLines.value
  const p = preview.value
  const line = p ? doc.value.lineAt(p.from) : null
  const tokensOf = syntaxLines(visibleFrom.value, visibleTo.value)
  const starts = new Set(hidden.value.map(([from]) => from - 1))
  const { marks, lineClasses } = lineDecorations.value
  return texts.map((text, i) => {
    const n = numbers[i]!
    const tokens = tokensOf(n)
    const wrapped = wrapOf(text)
    const folded = starts.has(n)
    if (!p || n !== line!.number) {
      const own = marks.get(n)
      return {
        n,
        text,
        tokens,
        wrapped,
        folded,
        marks: own,
        marksKey: own?.map((m) => m.join(',')).join(';'),
        lineClass: lineClasses.get(n),
      }
    }
    const col = p.from - line!.from
    const end = p.to <= line!.to ? p.to - line!.from : col
    return {
      n,
      text,
      tokens: null,
      wrapped,
      folded,
      compose: [text.slice(0, col), p.insert, text.slice(end)],
    }
  })
})

/** What extensions decorate, asked for while drawing. */
const decorations = computed<CodeDecoration[]>(() => {
  const out: CodeDecoration[] = []
  for (const extension of extensions.value)
    if (extension.decorations) out.push(...extension.decorations(context))
  return out
})

/** Decorations and problems on the lines in view, cut to each line. */
const lineDecorations = computed(() => {
  const marks = new Map<number, Mark[]>()
  const lineClasses = new Map<number, string>()
  const list = decorations.value
  const problems = diagnostics.value
  if (!list.length && !problems.length) return { marks, lineClasses }
  const text = doc.value
  const first = visibleFrom.value
  const last = visibleTo.value
  const start = text.line(first).from
  const end = text.line(last).to
  const mark = (from: number, to: number, cls: string, title?: string) => {
    if (to < start || from > end || to <= from) return
    const a = text.lineAt(Math.max(from, start))
    const b = text.lineAt(Math.min(to, end))
    for (let n = a.number; n <= b.number; n++) {
      const line = n === a.number ? a : n === b.number ? b : text.line(n)
      const x = Math.max(from, line.from) - line.from
      const y = Math.min(to, line.to) - line.from
      if (y <= x) continue
      const own = marks.get(n)
      const item: Mark = title ? [x, y, cls, title] : [x, y, cls]
      if (own) own.push(item)
      else marks.set(n, [item])
    }
  }
  for (const item of list) {
    if (item.type === 'line') {
      if (item.line < first || item.line > last) continue
      const had = lineClasses.get(item.line)
      lineClasses.set(item.line, had ? `${had} ${item.class}` : item.class)
    } else mark(item.from, item.to, item.class, item.title)
  }
  for (const problem of problems) {
    if (problem.from > end) break
    let { from, to } = problem
    // An empty range marks the character after it, or the one before at the end of a line.
    if (from === to) {
      const line = text.lineAt(from)
      if (from < line.to) to = line.from + moveCluster(line.text, from - line.from, 1)
      else if (from > line.from) from = line.from + moveCluster(line.text, from - line.from, -1)
      else continue
    }
    mark(from, to, `dou-code-editor__problem is-${problem.severity}`)
  }
  return { marks, lineClasses }
})

// ---------------------------------------------------------------- syntax

/** Lines read ahead of the last read one while drawing; further away, idle time catches up first. */
const SYNTAX_REACH = 2000
let highlighter: CodeHighlighter | null = null
/** Bumped when lines in view got their tokens in idle time. */
const syntaxTick = ref(0)

watch(
  () => props.language,
  (language) => {
    highlighter = language ? markRaw(new CodeHighlighter(language, doc.value, props.tabSize)) : null
    syntaxTick.value++
  },
  { immediate: true },
)

/** Gets the tokens of the lines in view, asking idle time for the ones too far ahead. */
function syntaxLines(from: number, to: number): (n: number) => CodeLineTokens | null {
  void syntaxTick.value
  const hl = highlighter
  if (!hl) return () => null
  if (!hl.ready(to) && to - hl.frontier > SYNTAX_REACH) {
    scheduleSyntax(to)
    return (n) => (hl.ready(n) ? hl.line(n) : null)
  }
  return (n) => hl.line(n)
}

let syntaxJob = 0
let syntaxUntil = 0
const idle =
  typeof requestIdleCallback === 'function'
    ? (task: () => void) => requestIdleCallback(task, { timeout: 100 })
    : (task: () => void) => window.setTimeout(task, 16)
const cancelIdle = (id: number) =>
  typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id)

function scheduleSyntax(until: number) {
  syntaxUntil = Math.max(syntaxUntil, until)
  if (syntaxJob) return
  syntaxJob = idle(() => {
    syntaxJob = 0
    const hl = highlighter
    if (!hl) return
    hl.work(performance.now() + 8, syntaxUntil)
    if (hl.ready(syntaxUntil)) {
      syntaxUntil = 0
      syntaxTick.value++
    } else scheduleSyntax(syntaxUntil)
  })
}

/** The kind of token the character at `pos` is part of, when its line has been read. */
function syntaxAt(pos: number): CodeTokenType | null {
  const hl = highlighter
  if (!hl || pos < 0 || pos >= doc.value.length) return null
  const line = doc.value.lineAt(pos)
  const tokens = hl.line(line.number, SYNTAX_REACH)
  if (!tokens) return null
  const col = pos - line.from
  for (let i = 0; i < tokens.length; i += 2) {
    if (col < tokens[i]!) {
      const type = tokens[i + 1]!
      return type < 0 ? null : tokenTypes[type]!
    }
  }
  return null
}

function languageAt(pos: number) {
  const hl = highlighter
  if (!hl) return null
  const line = doc.value.lineAt(Math.min(Math.max(pos, 0), doc.value.length))
  // Within reach only: far down an unread file, the outer language will do.
  if (line.number - hl.frontier > SYNTAX_REACH) return hl.language
  return hl.languageAt(line.number)
}

/** A piece of a line, with the classes it is drawn with and the title of a mark over it. */
type Part = [text: string, cls: string | null, title?: string]

/** A line cut where its tokens and marks start and end, each piece with its classes. */
function partsOf(row: Row): Part[] {
  const base = lineParts(row.text, row.tokens)
  const marks = row.marks
  if (!marks?.length) return base.map(([text, type]) => [text, type && `dou-syntax-${type}`])
  const cuts = new Set<number>([0, row.text.length])
  for (const [from, to] of marks) {
    cuts.add(from)
    cuts.add(to)
  }
  let at = 0
  for (const [text] of base) {
    cuts.add(at)
    at += text.length
  }
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  const points = [...cuts].sort((a, b) => a - b)
  const out: Part[] = []
  let index = 0
  let partStart = 0
  for (let i = 0; i + 1 < points.length; i++) {
    const from = points[i]!
    const to = points[i + 1]!
    if (to <= from || from >= row.text.length) continue
    while (partStart + base[index]![0].length <= from) partStart += base[index++]![0].length
    const type = base[index]![1]
    let cls = type ? `dou-syntax-${type}` : ''
    let title: string | undefined
    for (const [a, b, name, label] of marks)
      if (a <= from && b >= to) {
        cls = cls ? `${cls} ${name}` : name
        title = label ?? title
      }
    const piece = row.text.slice(from, to)
    out.push(title ? [piece, cls || null, title] : [piece, cls || null])
  }
  return out
}

/** The parts of one row of a wrapped line. */
function rowParts(row: Row, sub: number) {
  const { breaks } = row.wrapped
  const start = sub ? breaks[sub - 1]! : 0
  const end = sub < breaks.length ? breaks[sub]! : row.text.length
  const out: Part[] = []
  let at = 0
  for (const [text, type, title] of partsOf(row)) {
    const from = Math.max(at, start)
    const to = Math.min(at + text.length, end)
    if (to > from) out.push([text.slice(from - at, to - at), type, title])
    at += text.length
  }
  return out
}

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
    const pos = range.head
    const line = text.lineAt(pos)
    if (!isShown(line.number)) return
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
    const at = place(line.number, lineStr, pos - line.from)
    out.push({ key: `c${i}`, left: PAD_X + at.x, top: at.top, width: 2 })
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
      if (!layout.value.shown(n)) continue
      const str = lineText(n)
      const a = n === from.number ? rangeFrom(range) - from.from : 0
      const b = n === to.number ? rangeTo(range) - to.from : str.length
      // A selected line break shows as half a cell past the end.
      const boxes = spans(n, str, a, b, n === to.number ? 0 : measure.cell / 2)
      boxes.forEach((box, k) =>
        out.push({ key: `s${i}-${n}-${k}`, ...box, left: PAD_X + box.left }),
      )
    }
  })
  return out
})

const activeLineTop = computed(() => {
  const n = doc.value.lineAt(mainRange(state.value.selection).head).number
  return isShown(n) ? yOf(n) : null
})
const activeLineRows = computed(() => layout.value.rowsOf(activeLineNumber.value) || 1)
const activeLineNumber = computed(
  () => doc.value.lineAt(mainRange(state.value.selection).head).number,
)

/** The bracket at the main cursor and its partner, outlined; a bracket without one is marked. */
const bracketBoxes = computed(() => {
  void metrics.value
  void syntaxTick.value
  if (!props.matchBrackets || !props.language || !focused.value || preview.value) return []
  const main = mainRange(state.value.selection)
  if (!isEmptyRange(main)) return []
  const text = doc.value
  const brackets = languageAt(main.head)?.brackets ?? props.language.brackets
  const found = matchBracket(text, main.head, brackets, (pos) => {
    const kind = syntaxAt(pos)
    return kind === 'string' || kind === 'comment'
  })
  if (!found) return []
  const out: Array<Box & { matched: boolean }> = []
  for (const pos of found.match === null ? [found.from] : [found.from, found.match]) {
    const line = text.lineAt(pos)
    if (!isShown(line.number)) continue
    const str = lineText(line.number)
    const [box] = spans(line.number, str, pos - line.from, pos - line.from + 1)
    if (box)
      out.push({ key: `b${pos}`, ...box, left: PAD_X + box.left, matched: found.match !== null })
  }
  return out
})

// ---------------------------------------------------------------- search

const messages = useCodeMessages(() => props.messages)
const searchOpen = ref(false)
const showReplace = ref(false)
const query = ref<CodeSearchQuery>({ search: '' })
const panel = ref<InstanceType<typeof SearchPanel>>()
/** The matches, kept in step with edits between searches. */
const matches = shallowRef<CodeMatch[]>([])
const capped = ref(false)
const searchError = ref<string>()
/** Read out after a replacement. */
const announcement = ref('')
let searchTimer = 0

function runSearch() {
  clearTimeout(searchTimer)
  searchTimer = 0
  if (!searchOpen.value || !query.value.search) {
    matches.value = []
    capped.value = false
    searchError.value = undefined
    return
  }
  const result = searchText(doc.value, query.value)
  matches.value = result.matches
  capped.value = result.capped
  searchError.value = result.error
}

/** Searches again a little later, so typing in a long text doesn't search on every key. */
function scheduleSearch(delay = 120) {
  clearTimeout(searchTimer)
  searchTimer = window.setTimeout(runSearch, delay)
}

watch(query, () => {
  runSearch()
  // While typing the search, the first match from the selection on is selected, as a preview.
  revealMatch(matchAfter(matches.value, rangeFrom(mainRange(state.value.selection))))
})

/** Moves the matches along with an edit, and searches again soon. */
function mapMatches(changes: ChangeSet) {
  if (!searchOpen.value || !matches.value.length) return
  matches.value = matches.value
    .map((m) => ({ from: changes.mapPos(m.from, 1), to: changes.mapPos(m.to, -1) }))
    .filter((m) => m.to > m.from)
  scheduleSearch(doc.value.length > 200_000 ? 300 : 120)
}

/** Which match the main selection is exactly on, or `-1`. */
const currentMatch = computed(() => {
  const main = mainRange(state.value.selection)
  const i = matchAfter(matches.value, rangeFrom(main))
  const m = matches.value[i]
  return m && m.from === rangeFrom(main) && m.to === rangeTo(main) ? i : -1
})

function revealMatch(index: number) {
  const m = matches.value[index]
  if (!m) return false
  dispatch(transaction().select(m.from, m.to).setMeta({ scroll: true }))
  return true
}

function nextMatch() {
  if (!matches.value.length) return false
  const main = mainRange(state.value.selection)
  const at = currentMatch.value >= 0 ? rangeTo(main) : rangeFrom(main)
  let i = matchAfter(matches.value, at)
  if (currentMatch.value >= 0 && i === currentMatch.value) i = (i + 1) % matches.value.length
  return revealMatch(i)
}

function previousMatch() {
  if (!matches.value.length) return false
  const list = matches.value
  const from = rangeFrom(mainRange(state.value.selection))
  const after = matchAfter(list, from)
  // `matchAfter` wraps to the first past the end; the one before the cursor is then the last.
  return revealMatch(
    list[after]!.from < from ? list.length - 1 : (after - 1 + list.length) % list.length,
  )
}

function openSearch(replace = false, given?: Partial<CodeSearchQuery>) {
  if (!props.searchable) return
  menuOpen.value = false
  closeProblems()
  const main = mainRange(state.value.selection)
  const patch: Partial<CodeSearchQuery> = { ...given }
  // A selection on one line, or else the word at the cursor, becomes the search.
  if (given?.search === undefined) {
    const selected = doc.value.slice(rangeFrom(main), rangeTo(main))
    if (selected && !selected.includes('\n')) patch.search = selected
    else if (!selected) {
      const line = doc.value.lineAt(main.head)
      const col = main.head - line.from
      const text = lineText(line.number)
      for (const at of [col, col - 1]) {
        if (at < 0 || at >= text.length || !/[\p{L}\p{N}_$]/u.test(text[at]!)) continue
        const word = wordAt(text, at)
        patch.search = text.slice(word.from, word.to)
        // Select it, so the search starts from this word rather than the next one.
        dispatch(transaction().select(line.from + word.from, line.from + word.to))
        break
      }
    }
  }
  if (Object.keys(patch).length) query.value = { ...query.value, ...patch }
  // Given a replacement, the replace box opens with it.
  if ((replace || given?.replace !== undefined) && !target.readonly) showReplace.value = true
  searchOpen.value = true
  runSearch()
  panel.value?.focus(replace ? 'replace' : 'find')
  nextTick(() => panel.value?.focus(replace ? 'replace' : 'find'))
}

function closeSearch() {
  if (!searchOpen.value) return false
  searchOpen.value = false
  matches.value = []
  focusInput()
  return true
}

function replaceOne() {
  if (target.readonly) return
  if (currentMatch.value < 0) {
    nextMatch()
    return
  }
  const m = matches.value[currentMatch.value]!
  const insert = replacementFor(doc.value, m, query.value)
  const tr = transaction().setMeta({ action: 'replace', scroll: true })
  tr.replace(m.from, m.to, insert)
  dispatch(tr)
  runSearch()
  // On to the next match after the replaced text.
  const i = matchAfter(matches.value, m.from + insert.length)
  if (i >= 0 && (matches.value[i]!.from >= m.from + insert.length || i === 0)) revealMatch(i)
}

function replaceAll() {
  if (target.readonly) return
  // Every match, also past the number shown.
  const all = capped.value ? searchText(doc.value, query.value, Infinity).matches : matches.value
  if (!all.length) return
  const text = doc.value
  const tr = transaction().setMeta({ action: 'replace', scroll: true })
  for (const m of all) tr.replace(m.from, m.to, replacementFor(text, m, query.value))
  dispatch(tr)
  // Leave a cursor rather than a selection on the last replacement, which would look like a match left over.
  const head = mainRange(state.value.selection).head
  dispatch(transaction().select(head))
  announcement.value = format(messages.value.replaced, { count: all.length })
  runSearch()
}

/** The matches on the lines in view, as boxes; the one selected stands out. */
const matchBoxes = computed(() => {
  void metrics.value
  if (!searchOpen.value || !matches.value.length) return []
  const text = doc.value
  const first = text.line(visibleFrom.value).from
  const last = text.line(visibleTo.value).to
  const out: Array<Box & { current: boolean }> = []
  for (let i = matchAfter(matches.value, first); i >= 0 && i < matches.value.length; i++) {
    const m = matches.value[i]!
    // Past the view, or wrapped around to the first match above it.
    if (m.from > last || m.to < first) break
    const from = text.lineAt(m.from)
    const to = text.lineAt(m.to)
    for (
      let n = Math.max(from.number, visibleFrom.value);
      n <= Math.min(to.number, visibleTo.value);
      n++
    ) {
      if (!layout.value.shown(n)) continue
      const str = lineText(n)
      const a = n === from.number ? m.from - from.from : 0
      const b = n === to.number ? m.to - to.from : str.length
      spans(n, str, a, b).forEach((box, k) =>
        out.push({
          key: `m${m.from}-${n}-${k}`,
          ...box,
          left: PAD_X + box.left,
          current: i === currentMatch.value,
        }),
      )
    }
    if (out.length > 2000) break
  }
  return out
})

/** Marks beside the scrollbar for where the matches are in the whole text, one per pixel row. */
const searchMarks = computed(() => {
  if (!searchOpen.value || !matches.value.length) return []
  const text = doc.value
  const drawn = layout.value
  /** Where a line sits in the whole text, from 0 to 1, as drawn (wrapped rows and folds counted). */
  const share = (pos: number) => (drawn.rowOf(text.lineAt(pos).number) + 0.5) / drawn.total
  const taken = new Set<number>()
  const out: Array<{ top: number; current: boolean }> = []
  const current = matches.value[currentMatch.value]
  // A thousand evenly spread matches show the picture; more only cost time.
  const step = Math.max(1, Math.floor(matches.value.length / 1000))
  for (let i = 0; i < matches.value.length; i += step) {
    const top = Math.round(share(matches.value[i]!.from) * 1000) / 10
    if (taken.has(top)) continue
    taken.add(top)
    out.push({ top, current: false })
  }
  if (current) out.push({ top: share(current.from) * 100, current: true })
  return out
})

// ---------------------------------------------------------------- problems

/** The box over a place in the text with the problems there and their fixes; `keyboard` when opened by a key, so arrows pick a fix. */
const problemBox = shallowRef<{
  pos: number
  problems: CodeDiagnostic[]
  index: number
  keyboard: boolean
} | null>(null)
const problemEl = ref<HTMLElement>()
const problemSize = ref({ width: 0, height: 0 })
let problemTimer = 0

/** The problems that cover a position; an empty one covers the character it marks. */
function problemsAt(pos: number) {
  const out: CodeDiagnostic[] = []
  for (const problem of diagnostics.value) {
    if (problem.from > pos) break
    if (pos <= Math.max(problem.to, problem.from + 1)) out.push(problem)
  }
  return out
}

const fixes = computed(() =>
  (problemBox.value?.problems ?? []).flatMap((problem) =>
    (problem.actions ?? []).map((action) => ({ problem, action })),
  ),
)

function showProblems(pos: number, keyboard: boolean) {
  clearTimeout(problemTimer)
  const problems = problemsAt(pos)
  if (!problems.length) {
    problemBox.value = null
    return false
  }
  const hasFixes = problems.some((problem) => problem.actions?.length)
  problemBox.value = { pos, problems, index: keyboard && hasFixes ? 0 : -1, keyboard }
  return true
}

function closeProblems() {
  clearTimeout(problemTimer)
  problemBox.value = null
}

function runFix(index: number) {
  const fix = fixes.value[index]
  if (!fix) return
  closeProblems()
  fix.action.run(context, fix.problem)
  focusInput()
}

/** Moves the cursor to the next problem after it (`1`) or before it (`-1`), going round, and shows it. */
function goToProblem(direction: 1 | -1) {
  const list = diagnostics.value
  if (!list.length) return false
  const head = mainRange(state.value.selection).head
  let found: CodeDiagnostic | undefined
  if (direction > 0) found = list.find((problem) => problem.from > head) ?? list[0]
  else {
    for (let i = list.length - 1; i >= 0 && !found; i--) if (list[i]!.from < head) found = list[i]
    found ??= list[list.length - 1]
  }
  const problem = found!
  dispatch(transaction().select(problem.from).setMeta({ scroll: true }))
  showProblems(problem.from, true)
  const m = messages.value
  announce(
    format(m.problemAt, {
      line: doc.value.lineAt(problem.from).number,
      severity: m[problem.severity],
      message: problem.message,
    }),
  )
  return true
}

const diagnosticControl = {
  next: () => goToProblem(1),
  previous: () => goToProblem(-1),
  showFixes: () => showProblems(mainRange(state.value.selection).head, true),
}

/** Keys while the box is open from the keyboard: arrows pick a fix, Enter makes it, Escape closes the box. */
function problemKey(name: string) {
  const box = problemBox.value
  if (!box) return false
  if (name === 'escape') {
    closeProblems()
    return true
  }
  const count = fixes.value.length
  if (!box.keyboard || !count) return false
  if (name === 'arrowdown' || name === 'arrowup') {
    const step = name === 'arrowdown' ? 1 : -1
    problemBox.value = { ...box, index: (box.index + step + count) % count }
    return true
  }
  if (name === 'enter' || name === 'tab') {
    runFix(Math.max(0, box.index))
    return true
  }
  return false
}

/**
 * Shows the problems under the mouse after a moment; leaving them hides the
 * box a moment later. Fingers are left out: a tap shows the box itself, and
 * the mouse events a browser makes up after it would only close it again.
 */
function onContentHover(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || drag || problemBox.value?.keyboard) return
  const rect = content.value?.getBoundingClientRect()
  if (!rect) return
  const point = { x: event.clientX, y: event.clientY }
  const pos = posAtCoords(point)
  const at = coordsAtPos(pos)
  // Only over the text itself, not the empty space after a line.
  const over = !!at && Math.abs(point.x - at.left) <= measure.cell * 2
  const problems = over ? problemsAt(pos) : []
  const box = problemBox.value
  if (box && problems.length && problems.every((problem) => box.problems.includes(problem))) {
    clearTimeout(problemTimer)
    return
  }
  clearTimeout(problemTimer)
  problemTimer = window.setTimeout(
    () => (problems.length ? showProblems(pos, false) : closeProblems()),
    problems.length ? 350 : 250,
  )
}

/** The mouse came onto the box: it stays. */
function keepProblems() {
  clearTimeout(problemTimer)
}

function onContentLeave(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || problemBox.value?.keyboard) return
  clearTimeout(problemTimer)
  problemTimer = window.setTimeout(closeProblems, 250)
}

// Below the line, above it when there is no room, always in view.
const problemStyle = computed(() => {
  const box = problemBox.value
  if (!box) return null
  const at = pointOf(box.pos)
  if (!at) return null
  const view = visibleBox()
  const { width, height } = problemSize.value
  const lh = lineHeight.value
  // A finger's cursor has its handle below the line: the box goes above when there is room, or under the handle.
  const below = at.top + lh + 4
  const roomBelow = view.bottom - 4 - below
  const roomAbove = at.top - 4 - view.top
  // A finger's cursor has its handle below the line, which the box keeps clear of where it can.
  const handle = touchUi.value && caretHandle.value ? HANDLE : 0
  let top: number
  let room: number
  if (roomBelow - handle >= height) [top, room] = [below + handle, roomBelow - handle]
  else if (roomAbove >= height) [top, room] = [at.top - 4 - height, roomAbove]
  else if (roomBelow >= height || roomBelow >= roomAbove) [top, room] = [below, roomBelow]
  // Too tall for either side: on the roomier one, scrolling inside.
  else [top, room] = [view.top + 4, roomAbove]
  const left = Math.max(view.left + 4, Math.min(at.x - 12, view.right - width - 4))
  return {
    transform: `translate(${Math.round(left)}px, ${Math.round(top)}px)`,
    maxHeight: height > room ? `${Math.max(0, Math.floor(room))}px` : undefined,
  }
})

watch(
  [problemEl, problemBox],
  () => {
    const el = problemEl.value
    // Its whole height, even while it is cut short and scrolls.
    if (el)
      problemSize.value = {
        width: el.offsetWidth,
        height: el.scrollHeight + el.offsetHeight - el.clientHeight,
      }
  },
  { flush: 'post' },
)

/** Where the problems sit along the scrollbar, by severity. */
const problemMarks = computed(() => {
  const list = diagnostics.value
  if (!list.length) return []
  const text = doc.value
  const drawn = layout.value
  const taken = new Set<string>()
  const out: Array<{ top: number; severity: CodeDiagnosticSeverity }> = []
  for (const problem of list) {
    const top =
      Math.round(((drawn.rowOf(text.lineAt(problem.from).number) + 0.5) / drawn.total) * 1000) / 10
    const key = `${top}${problem.severity}`
    if (taken.has(key)) continue
    taken.add(key)
    out.push({ top, severity: problem.severity })
    if (out.length >= 1000) break
  }
  return out
})

// ---------------------------------------------------------------- panels

const panels = computed(() => {
  const top: CodePanel[] = []
  const bottom: typeof top = []
  for (const extension of extensions.value)
    for (const bar of extension.panels?.(context) ?? [])
      (bar.position === 'top' ? top : bottom).push(bar)
  return { top, bottom }
})

const searchControl = {
  open: (replace?: boolean) => openSearch(replace),
  close: closeSearch,
  next: () => nextMatch(),
  previous: () => previousMatch(),
}

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
  // Put the textarea where its caret lines up with the drawn main cursor, so input methods open there.
  const startLine = text.lineAt(from)
  const headLine = text.lineAt(main.head)
  const headText = headLine.number === startLine.number ? startLine.text : headLine.text
  const caret = place(headLine.number, headText, main.head - headLine.from)
  const lineStart = headLine.number === startLine.number ? from - startLine.from : 0
  inputBox.value = {
    top: caret.top - (headLine.number - startLine.number) * lineHeight.value,
    left:
      PAD_X +
      caret.x -
      (measure.x(headText, main.head - headLine.from) - measure.x(headText, lineStart)),
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
  let { insert } = diff
  // The Enter that confirmed a composition only confirms it.
  if (insert.endsWith('\n') && performance.now() - confirmEnter < 200) {
    insert = insert.slice(0, -1)
    confirmEnter = -Infinity
  }
  if (!insert && from === to) return syncInput()
  const { doc: text, selection } = state.value
  const main = mainRange(selection)
  // Typing over the selection or at the cursor: the same goes to every cursor.
  if (from === rangeFrom(main) && to === rangeTo(main) && insert) {
    if (insert === '\n') return run(insertNewline)
    if (insertText(target, insert)) return
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
  get language() {
    return props.language ?? null
  },
  get closeBrackets() {
    return props.closeBrackets
  },
  transaction,
  dispatch,
  moveVertically,
  undo,
  redo,
  languageAt,
  syntaxAt,
  get search() {
    return props.searchable ? searchControl : undefined
  },
  get folding() {
    return props.foldable ? folding : undefined
  },
  get diagnostics() {
    return diagnosticControl
  },
}

function run(command: CodeCommand) {
  return command(target)
}

/** Moves by rows as drawn: a wrapped line's rows one by one, over folded lines. */
function moveVertically(range: CodeRange, count: number) {
  const { doc: text } = state.value
  const line = text.lineAt(range.head)
  const at = place(line.number, line.text, range.head - line.from)
  const goal = goals.get(range.head) ?? at.x
  const row = layout.value.rowOf(line.number) + at.sub + count
  let head: number
  if (row < 0) head = 0
  else if (row >= layout.value.total) head = text.length
  else {
    const { n, sub } = layout.value.lineAtRow(row)
    const next = text.line(n)
    head = next.from + colAt(next.text, sub, goal)
  }
  pendingGoals.set(head, goal)
  return head
}

/** The extensions' keys, lowest priority first, since later bindings are tried first. */
function extensionKeys() {
  const list = extensions.value
  const out: CodeKeyBinding[] = []
  for (let i = list.length - 1; i >= 0; i--) out.push(...(list[i]!.keymap ?? []))
  return out
}

const keymap = computed(() =>
  buildKeymap([...defaultKeymap, ...extensionKeys(), ...(props.keymap ?? [])], apple),
)
/** After Escape, Tab leaves the editor instead of indenting, so keyboard users are never stuck. */
let tabLeaves = false

/** When Enter last confirmed a composition; some browsers also put a line break into the textarea for it, right after. */
let confirmEnter = -Infinity

function onKeydown(event: KeyboardEvent) {
  if (isComposing(event) || composing.value) {
    if (event.key === 'Enter') confirmEnter = performance.now()
    return
  }
  confirmEnter = -Infinity
  const name = eventKey(event, apple)
  if (problemKey(name)) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  // Escape first puts away the toolbar over the selection.
  if (name === 'escape' && menuOpen.value) {
    menuOpen.value = false
    event.preventDefault()
    event.stopPropagation()
    return
  }
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
  event.preventDefault()
  pasteText(event.clipboardData?.getData('text/plain'))
}

function pasteText(text: string | undefined) {
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
  const { n, sub } = layout.value.lineAtRow(rowAtY(point.y - rect.top))
  const line = state.value.doc.line(n)
  return line.from + colAt(line.text, sub, point.x - rect.left - PAD_X)
}

function coordsAtPos(pos: number) {
  const rect = content.value?.getBoundingClientRect()
  if (!rect) return null
  const line = doc.value.lineAt(pos)
  if (!isShown(line.number)) return null
  const at = place(line.number, line.text, pos - line.from)
  const top = rect.top + at.top
  return { left: rect.left + PAD_X + at.x, top, bottom: top + lineHeight.value }
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
  /** Where a column selection (Alt + Shift drag) started. */
  column?: { n: number; x: number }
  /** A finger drags: from a handle, or after a long press. */
  touch?: boolean
  /** A handle under a lone cursor moves the cursor, selecting nothing. */
  caret?: boolean
  /** From the finger to the text point it moves, so the handle doesn't jump under the finger. */
  offset?: { x: number; y: number }
} | null = null

/** The line and the x inside the text (from the line's start) under a point in the page. */
function lineAtCoords(point: { x: number; y: number }) {
  const rect = content.value!.getBoundingClientRect()
  const { n } = layout.value.lineAtRow(rowAtY(point.y - rect.top))
  return { n, x: Math.max(0, point.x - rect.left - PAD_X) }
}

/** A rectangle of text from the drag's start to `point`: one range per line, cut at the same x. */
function extendColumns(point: { x: number; y: number }) {
  const start = drag!.column!
  const end = lineAtCoords(point)
  const ranges: CodeRange[] = []
  const step = end.n >= start.n ? 1 : -1
  for (let n = start.n; ; n += step) {
    if (!layout.value.shown(n) && n !== end.n) continue
    const line = doc.value.line(n)
    const anchor = line.from + measure.col(line.text, start.x)
    const head = line.from + measure.col(line.text, end.x)
    // Lines too short to reach the rectangle are left out, unless the rectangle is only a line of cursors.
    if (anchor !== head || start.x === end.x || measure.x(line.text, line.text.length) >= start.x)
      ranges.push({ anchor, head })
    if (n === end.n) break
  }
  if (!ranges.length) return
  dispatch(
    transaction()
      .select(normalizeSelection({ ranges, main: ranges.length - 1 }, doc.value.length))
      .setMeta({ scroll: false }),
  )
}

function extendTo(point: { x: number; y: number }) {
  if (!drag) return
  if (drag.column) return extendColumns(point)
  const { offset } = drag
  const pos = posAtCoords(offset ? { x: point.x - offset.x, y: point.y - offset.y } : point)
  if (drag.caret) {
    dispatch(transaction().select(pos).setMeta({ scroll: false }))
    caretHandle.value = true
    return
  }
  // A handle keeps at least one character selected.
  if (offset && pos === drag.start.from) return
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

function startDrag(
  event: PointerEvent | { clientX: number; clientY: number },
  unit: Unit,
  start: { from: number; to: number },
  hold = holdPointer(event as PointerEvent, root.value),
  touch?: { caret?: boolean; offset?: { x: number; y: number } },
) {
  drag = {
    unit,
    start,
    x: event.clientX,
    y: event.clientY,
    frame: 0,
    hold,
    touch: !!touch,
    ...touch,
  }
  touchDrag.value = !!touch
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
  const { touch, caret } = drag
  drag = null
  touchDrag.value = false
  // A selection made by finger offers what can be done with it.
  if (touch && !caret && !isEmptyRange(mainRange(state.value.selection))) menuOpen.value = true
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

function focusInput() {
  if (props.disabled) return
  input.value?.focus({ preventScroll: true })
}

/** Selects the unit at `pos`: alone, extending the main range (`extend`), or as one more range (`add`). */
function select(unit: Unit, pos: number, extend: boolean, add = false) {
  const at = unitAt(pos, unit)
  const { selection } = state.value
  const main = mainRange(selection)
  const range = extend
    ? { anchor: main.anchor, head: pos < main.anchor ? at.from : at.to }
    : { anchor: at.from, head: at.to }
  const next = add
    ? { ranges: [...selection.ranges, range], main: selection.ranges.length }
    : { ranges: [range], main: 0 }
  dispatch(
    transaction().select(normalizeSelection(next, doc.value.length)).setMeta({ scroll: false }),
  )
  // A drag goes on from the anchor kept by Shift, or from the unit pressed.
  return extend ? { from: main.anchor, to: main.anchor } : at
}

/** A tap that may turn into a scroll or a long press; touches only act once they end in place. */
let touch: {
  x: number
  y: number
  timer: number
  pointer: number
  /** Taken at the press, so a long press can keep the page from scrolling. */
  hold: ReturnType<typeof holdPointer>
} | null = null

/** The fold toggle or folded marker under a pointer, as the line it belongs to. */
function foldTarget(event: Event) {
  const el = (event.target as Element | null)?.closest?.('[data-fold], [data-unfold]')
  if (!el) return null
  const unfold = el.getAttribute('data-unfold')
  return unfold
    ? { n: Number(unfold), folded: true }
    : { n: Number(el.getAttribute('data-fold')), folded: el.classList.contains('is-folded') }
}

function onPointerDown(event: PointerEvent, area: 'text' | 'gutter') {
  if (event.button !== 0 || props.disabled) return
  const cell = (event.target as Element | null)?.closest?.('[data-gutter-cell]')
  const column = cell && gutterColumns.value[Number(cell.getAttribute('data-gutter-cell'))]
  if (column?.onPress) {
    event.preventDefault()
    event.stopPropagation()
    column.onPress(Number(cell!.getAttribute('data-line')), event)
    return
  }
  const fold = foldTarget(event)
  if (fold) {
    event.preventDefault()
    event.stopPropagation()
    toggleFold(fold.n, fold.folded)
    return
  }
  const pos = posAtCoords({ x: event.clientX, y: event.clientY })
  if (event.pointerType !== 'mouse') {
    onPointerCancel()
    const x = event.clientX
    const y = event.clientY
    touch = {
      x,
      y,
      pointer: event.pointerId,
      hold: holdPointer(event, root.value),
      // A long press selects the word under the finger; sliding on from there selects word by word.
      timer: window.setTimeout(() => {
        if (!touch) return
        const { hold } = touch
        touch = null
        touchUi.value = true
        const unit: Unit = area === 'gutter' ? 'line' : 'word'
        const at = select(unit, pos, false)
        focusInput()
        startDrag({ clientX: x, clientY: y }, unit, at, hold, {})
      }, 450),
    }
    return
  }
  touchUi.value = false
  menuOpen.value = false
  closeProblems()
  event.preventDefault()
  focusInput()
  // Alt + Shift drag selects a rectangle, one range per line.
  if (event.altKey && event.shiftKey && area === 'text') {
    startDrag(event, 'char', { from: pos, to: pos })
    drag!.column = lineAtCoords({ x: event.clientX, y: event.clientY })
    extendColumns({ x: event.clientX, y: event.clientY })
    return
  }
  const count = countClick(event)
  const unit: Unit = area === 'gutter' || count === 3 ? 'line' : count === 2 ? 'word' : 'char'
  // Alt + click adds a cursor; dragging from there selects with it.
  startDrag(event, unit, select(unit, pos, event.shiftKey, event.altKey && !event.shiftKey))
}

/**
 * Counts quick clicks in one spot ourselves: a `pointerdown`'s `detail` is
 * 0 in some browsers, and the `mousedown` that has it is held back here.
 */
let lastClick = { time: 0, x: 0, y: 0, count: 0 }
function countClick(event: PointerEvent) {
  const near =
    Math.abs(event.clientX - lastClick.x) < 4 && Math.abs(event.clientY - lastClick.y) < 4
  const count = near && event.timeStamp - lastClick.time < 500 ? (lastClick.count % 3) + 1 : 1
  lastClick = { time: event.timeStamp, x: event.clientX, y: event.clientY, count }
  return count
}

function onPointerMove(event: PointerEvent) {
  if (!touch || event.pointerId !== touch.pointer) return
  // Moving before the long press is a scroll, which the page goes on with.
  if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 8) onPointerCancel()
}

function onPointerUp(event: PointerEvent, area: 'text' | 'gutter') {
  if (!touch || event.pointerId !== touch.pointer) return
  onPointerCancel()
  const pos = posAtCoords({ x: event.clientX, y: event.clientY })
  const main = mainRange(state.value.selection)
  // A tap on the cursor itself opens the toolbar, or puts it away.
  const onCursor =
    area === 'text' && focused.value && isEmptyRange(main) && main.head === pos && caretHandle.value
  const wasOpen = menuOpen.value
  touchUi.value = true
  select(area === 'gutter' ? 'line' : 'char', pos, false)
  caretHandle.value = area === 'text'
  menuOpen.value = area === 'gutter' || (onCursor && !wasOpen)
  // A tap on a problem shows it, the way hovering does with a mouse.
  if (area === 'text' && !menuOpen.value) showProblems(pos, false)
  focusInput()
}

function onPointerCancel() {
  if (touch) {
    clearTimeout(touch.timer)
    touch.hold.release()
  }
  touch = null
}

// ---------------------------------------------------------------- touch: handles, toolbar, magnifier

/** The part of the content in view, in its own px. */
function visibleBox() {
  const top = scrollTop.value + (clip.value?.top ?? 0)
  const bottom = scrollTop.value + (clip.value?.bottom ?? viewHeight.value)
  const left = scrollLeft.value
  return { top, bottom, left, right: left + Math.max(0, viewWidth.value - gutterWidth.value) }
}

/** Where a position is drawn in the content, when its line is in view. */
function pointOf(pos: number) {
  const line = doc.value.lineAt(pos)
  if (!isShown(line.number)) return null
  const at = place(line.number, lineText(line.number), pos - line.from)
  return { x: PAD_X + at.x, top: at.top, sub: at.sub, n: line.number }
}

type HandleKind = 'start' | 'end' | 'caret'

/** Handles under the ends of the selection, or under a lone cursor right after a tap. */
const handles = computed(() => {
  void metrics.value
  if (!touchUi.value || !focused.value || preview.value || props.disabled) return []
  const main = mainRange(state.value.selection)
  const ends: Array<[HandleKind, number]> = isEmptyRange(main)
    ? caretHandle.value && !props.readonly
      ? [['caret', main.head]]
      : []
    : [
        ['start', rangeFrom(main)],
        ['end', rangeTo(main)],
      ]
  const out: Array<{ kind: HandleKind; left: number; top: number }> = []
  for (const [kind, pos] of ends) {
    const at = pointOf(pos)
    if (at) out.push({ kind, left: at.x, top: at.top + lineHeight.value })
  }
  return out
})

/** A handle pressed but not moved yet: a press that stays put is a tap or a long press on the text below. */
let handlePress: {
  kind: HandleKind
  x: number
  y: number
  pointer: number
  hold: ReturnType<typeof holdPointer>
  timer: number
} | null = null

function onHandleDown(event: PointerEvent, kind: HandleKind) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  onPointerCancel()
  endHandlePress()
  const hold = holdPointer(event, root.value)
  hold.grab()
  handlePress = {
    kind,
    x: event.clientX,
    y: event.clientY,
    pointer: event.pointerId,
    hold,
    // The handle under a lone cursor reaches over the next line; held there, the press is for that line's text.
    timer:
      kind === 'caret'
        ? window.setTimeout(() => {
            if (!handlePress) return
            const { x, y } = handlePress
            const taken = handlePress.hold
            clearHandlePress()
            const at = select('word', posAtCoords({ x, y }), false)
            startDrag({ clientX: x, clientY: y }, 'word', at, taken, {})
          }, 450)
        : 0,
  }
  window.addEventListener('pointermove', onHandleMove)
  window.addEventListener('pointerup', onHandleUp)
  window.addEventListener('pointercancel', endHandlePress)
}

function clearHandlePress() {
  if (handlePress) clearTimeout(handlePress.timer)
  handlePress = null
  window.removeEventListener('pointermove', onHandleMove)
  window.removeEventListener('pointerup', onHandleUp)
  window.removeEventListener('pointercancel', endHandlePress)
}

function endHandlePress() {
  handlePress?.hold.release()
  clearHandlePress()
}

function onHandleMove(event: PointerEvent) {
  const press = handlePress
  if (!press || event.pointerId !== press.pointer) return
  if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 4) return
  const { kind, hold, x, y } = press
  clearHandlePress()
  const main = mainRange(state.value.selection)
  const pos = kind === 'start' ? rangeFrom(main) : kind === 'end' ? rangeTo(main) : main.head
  const fixed = kind === 'start' ? rangeTo(main) : kind === 'end' ? rangeFrom(main) : pos
  const at = coordsAtPos(pos)
  if (!at) return hold.release()
  // The end being dragged becomes the head, so the drag moves it.
  if (kind !== 'caret') dispatch(transaction().select(fixed, pos).setMeta({ scroll: false }))
  menuOpen.value = false
  // From where the finger went down, so the handle keeps its place under it.
  const offset = { x: x - at.left, y: y - (at.top + lineHeight.value / 2) }
  startDrag(event, 'char', { from: fixed, to: fixed }, hold, { caret: kind === 'caret', offset })
  onDragMove(event)
}

function onHandleUp(event: PointerEvent) {
  const press = handlePress
  if (!press || event.pointerId !== press.pointer) return
  endHandlePress()
  // A tap on the handle under the cursor opens the toolbar, or puts it away.
  if (press.kind === 'caret') menuOpen.value = !menuOpen.value
}

/** Room between the toolbar or magnifier and what they point at. */
const GAP = 8
/** How high a handle reaches below its line, which the toolbar keeps clear of. */
const HANDLE = 24

const menuEl = ref<HTMLElement>()
const menuSize = ref({ width: 0, height: 0 })
const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

/** The toolbar's buttons for the selection now. */
const menuItems = computed(() => {
  if (!menuOpen.value || !focused.value || props.disabled) return []
  const m = messages.value
  const main = mainRange(state.value.selection)
  const empty = isEmptyRange(main)
  const editable = !target.readonly
  const items: Array<{ key: string; label: string; run: () => void }> = []
  if (!empty && editable) items.push({ key: 'cut', label: m.cut, run: () => copySelection(true) })
  if (!empty) items.push({ key: 'copy', label: m.copy, run: () => copySelection(false) })
  if (editable && canPaste) items.push({ key: 'paste', label: m.paste, run: pasteFromClipboard })
  if (rangeFrom(main) > 0 || rangeTo(main) < doc.value.length)
    items.push({
      key: 'all',
      label: m.selectAll,
      run: () => {
        run(selectAll)
        menuOpen.value = true
      },
    })
  return items
})

// Above the selection; below it (past its handle) when there is no room; always in view.
const menuStyle = computed(() => {
  if (!menuItems.value.length) return null
  const main = mainRange(state.value.selection)
  const start = pointOf(rangeFrom(main))
  const end = pointOf(rangeTo(main))
  if (!start && !end) return null
  const view = visibleBox()
  const { width, height } = menuSize.value
  const lh = lineHeight.value
  const sameRow = start && end && start.top === end.top
  const x = sameRow ? (start.x + end.x) / 2 : (view.left + view.right) / 2
  const above = start ? start.top - GAP - height : -Infinity
  const below = (end ?? start)!.top + lh + HANDLE + GAP
  let top = above >= view.top + GAP ? above : below
  top = Math.max(view.top + GAP, Math.min(top, view.bottom - height - GAP))
  const left = Math.max(view.left + GAP, Math.min(x - width / 2, view.right - width - GAP))
  return { transform: `translate(${Math.round(left)}px, ${Math.round(top)}px)` }
})

watch(
  [menuEl, menuItems],
  () => {
    const el = menuEl.value
    if (el) menuSize.value = { width: el.offsetWidth, height: el.offsetHeight }
  },
  { flush: 'post' },
)

/** Copies through the textarea, which hands the selection to the copy event. */
function copyFromInput() {
  focusInput()
  document.execCommand('copy')
}

function writeClipboard(text: string) {
  const fallback = copyFromInput
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(fallback)
  else fallback()
}

function copySelection(cut: boolean) {
  const text = selectedText()
  if (!text) return
  writeClipboard(text)
  if (cut && !target.readonly)
    dispatch(transaction().replaceSelection('').setMeta({ action: 'cut' }))
  menuOpen.value = false
}

function pasteFromClipboard() {
  menuOpen.value = false
  navigator.clipboard
    .readText()
    .then((text) => pasteText(text))
    .catch(() => {})
}

/** The magnifier over a finger dragging the selection: the row at the moving end, larger. */
const MAGNIFIER = { width: 128, scale: 1.5 }
const magnifier = computed(() => {
  if (!touchDrag.value) return null
  void metrics.value
  const head = mainRange(state.value.selection).head
  const at = pointOf(head)
  if (!at) return null
  const row = rows.value.find((r) => r.n === at.n)
  if (!row) return null
  const lh = lineHeight.value
  const height = Math.round(lh * MAGNIFIER.scale) + 8
  const view = visibleBox()
  const { width } = MAGNIFIER
  const above = at.top - GAP - height
  const top = above >= view.top + 4 ? above : at.top + lh + HANDLE + GAP
  const left = Math.max(view.left + 4, Math.min(at.x - width / 2, view.right - width - 4))
  const parts = row.wrapped.breaks.length
    ? rowParts(row, at.sub)
    : row.tokens || row.marks
      ? partsOf(row)
      : ([[row.text, null]] as Part[])
  // The text, scaled from the row's left edge, slid so the moving end sits under the caret.
  const x = at.x - PAD_X
  const caret = Math.max(4, Math.min(width - 4, at.x - left))
  return {
    parts,
    indent: at.sub ? row.wrapped.indent : 0,
    style: {
      transform: `translate(${Math.round(left)}px, ${Math.round(top)}px)`,
      height: `${height}px`,
    },
    textStyle: {
      transform: `translateX(${caret - x * MAGNIFIER.scale}px) scale(${MAGNIFIER.scale})`,
    },
    caret,
  }
})

// ---------------------------------------------------------------- touch: keyboard

const showKeys = computed(
  () => !!props.keys && coarse && focused.value && !props.readonly && !props.disabled,
)
const keysList = computed(() => (Array.isArray(props.keys) ? props.keys : undefined))
const keysEditor = { run }
const { next: nextZIndex } = useZIndex()
const keysZIndex = ref<number>()
watch(showKeys, (shown) => {
  if (shown) keysZIndex.value = nextZIndex()
})
/** The height of the bar of keys, which the keyboard pushes up and the cursor keeps clear of. */
const KEYS_HEIGHT = 45
const viewport = ref({ top: 0, left: 0, width: 0, height: 0 })

function readViewport() {
  const vv = window.visualViewport
  viewport.value = vv
    ? { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height }
    : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
}

const keysStyle = computed(() => {
  const { top, left, width, height } = viewport.value
  return {
    transform: `translate(${left}px, ${top + height - KEYS_HEIGHT}px)`,
    width: `${width}px`,
    zIndex: keysZIndex.value,
  }
})

/**
 * Keeps the main cursor clear of the phone's keyboard and the bar above it:
 * scrolls the editor when the cursor can move inside it, else the page.
 */
function followViewport() {
  const vv = window.visualViewport
  const el = scroller.value
  if (!vv || !el || !focused.value) return
  const at = coordsAtPos(mainRange(state.value.selection).head)
  if (!at) return
  const lh = lineHeight.value
  // Room below the cursor for its handle too.
  const room = lh / 2 + (handles.value.length ? HANDLE : 0)
  const rect = el.getBoundingClientRect()
  const visibleTop = Math.max(rect.top, vv.offsetTop)
  const visibleBottom = Math.min(
    rect.bottom,
    vv.offsetTop + vv.height - (showKeys.value ? KEYS_HEIGHT : 0),
  )
  if (at.bottom + room > visibleBottom && visibleBottom - visibleTop >= lh * 3) {
    el.scrollTop += (at.bottom + room - visibleBottom) / ratio.value
    onScroll()
  } else if (at.top - lh / 2 < visibleTop && visibleBottom - visibleTop >= lh * 3) {
    el.scrollTop -= (visibleTop - at.top + lh / 2) / ratio.value
    onScroll()
  }
  // Whatever the editor couldn't scroll, the page does.
  const after = coordsAtPos(mainRange(state.value.selection).head)
  if (!after) return
  const bottom = vv.offsetTop + vv.height - (showKeys.value ? KEYS_HEIGHT : 0)
  if (after.bottom + room > bottom) window.scrollBy(0, after.bottom + room - bottom)
}

function onViewportChange() {
  readViewport()
  followViewport()
}

/** On a touch screen the keyboard comes and goes with focus; the view follows it meanwhile. */
const following = computed(() => coarse && focused.value)
function unfollow() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  vv?.removeEventListener('resize', onViewportChange)
  vv?.removeEventListener('scroll', readViewport)
}
watch(following, (on) => {
  const vv = window.visualViewport
  if (on) {
    readViewport()
    vv?.addEventListener('resize', onViewportChange)
    vv?.addEventListener('scroll', readViewport)
  } else unfollow()
})

// ---------------------------------------------------------------- scrolling

function onScroll() {
  const el = scroller.value
  if (!el) return
  scrollTop.value = el.scrollTop
  scrollLeft.value = el.scrollLeft
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
  const at = place(line.number, line.text, pos - line.from)
  const y = at.top - shift.value
  const top = el.scrollTop * ratio.value
  const margin = Math.min(lh, view / 4)
  if (y - margin < top) el.scrollTop = Math.max(0, (y - margin) / ratio.value)
  else if (y + lh + margin > top + view) el.scrollTop = (y + lh + margin - view) / ratio.value
  const x = PAD_X + at.x
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
  mounted.value = true
  window.addEventListener('scroll', onWindowScroll, { capture: true, passive: true })
  window.addEventListener('resize', onWindowScroll, { passive: true })
  document.addEventListener('selectionchange', onSelectionChange)
  // Web fonts change the cell width once they arrive.
  document.fonts?.ready.then(() => root.value && refreshMetrics())
  document.fonts?.addEventListener?.('loadingdone', refreshMetrics)
  if (props.autofocus) focusInput()
  for (const extension of extensions.value) startExtension(extension)
  runLint()
})

/** What each extension's `setup` returned, to run when it goes. */
const cleanups = new Map<CodeExtension, () => void>()
function startExtension(extension: CodeExtension) {
  if (cleanups.has(extension)) return
  const cleanup = extension.setup?.(context)
  cleanups.set(extension, typeof cleanup === 'function' ? cleanup : () => {})
}
watch(extensions, (next) => {
  if (!mounted.value) return
  for (const [extension, cleanup] of cleanups)
    if (!next.includes(extension)) {
      cleanup()
      cleanups.delete(extension)
    }
  for (const extension of next) startExtension(extension)
})

onBeforeUnmount(() => {
  if (syntaxJob) cancelIdle(syntaxJob)
  clearTimeout(searchTimer)
  resize?.disconnect()
  endDrag()
  onPointerCancel()
  endHandlePress()
  unfollow()
  clearTimeout(lintTimer)
  clearTimeout(problemTimer)
  for (const cleanup of cleanups.values()) cleanup()
  cleanups.clear()
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
  menuOpen.value = false
  if (problemBox.value?.keyboard) closeProblems()
  history.close()
  if (lazyDirty) {
    lazyDirty = false
    emit('update:modelValue', textOf(doc.value))
  }
  emit('blur', event)
}

const api: CodeExtensionContext = {
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
  openSearch: (given) => openSearch(false, given),
  closeSearch,
  fold: (line) => folding.fold(line),
  unfold: (line) => folding.unfold(line),
  foldAll: () => folding.foldAll(),
  unfoldAll: () => folding.unfoldAll(),
  get folds() {
    return foldStarts.value
  },
  get diagnostics() {
    return diagnostics.value
  },
  get visible() {
    return { from: visibleFrom.value, to: visibleTo.value }
  },
  announce,
}
context = api
provide(CODE_EDITOR_KEY, api)
defineExpose<CodeEditorExpose>(api)
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      ns.is('focused', focused),
      ns.is('readonly', !!readonly),
      ns.is('disabled', !!disabled),
      ns.is('foldable', foldable),
      ns.is('wrap', wrap),
    ]"
    :style="{
      '--dou-code-editor-gutter': `${gutterWidth}px`,
      '--dou-code-editor-gutter-cells': `${gutterCells}px`,
      '--dou-code-editor-tab-size': tabSize,
    }"
  >
    <div v-if="searchOpen" :class="ns.e('search')">
      <SearchPanel
        ref="panel"
        v-model:query="query"
        v-model:show-replace="showReplace"
        :messages="messages"
        :count="matches.length"
        :current="currentMatch"
        :capped="capped"
        :error="searchError"
        :readonly="readonly || disabled"
        @next="nextMatch()"
        @previous="previousMatch()"
        @replace="replaceOne"
        @replace-all="replaceAll"
        @close="closeSearch"
      />
    </div>
    <div v-if="problemMarks.length" :class="ns.e('marks')" aria-hidden="true">
      <div
        v-for="mark in problemMarks"
        :key="`${mark.top}${mark.severity}`"
        :class="[ns.e('mark'), ns.e('problem-mark'), ns.is(mark.severity, true)]"
        :style="{ top: `${mark.top}%` }"
      />
    </div>
    <div v-if="searchMarks.length" :class="ns.e('marks')" aria-hidden="true">
      <div
        v-for="mark in searchMarks"
        :key="`${mark.top}${mark.current ? 'c' : ''}`"
        :class="[ns.e('mark'), ns.is('current', mark.current)]"
        :style="{ top: `${mark.top}%` }"
      />
    </div>
    <div :class="ns.e('live')" aria-live="polite">{{ announcement }}</div>
    <div v-if="panels.top.length" :class="[ns.e('panels'), ns.is('top', true)]">
      <RenderPart v-for="panel in panels.top" :key="panel.key" :render="panel.render" />
    </div>
    <div ref="scroller" :class="ns.e('scroller')" @scroll.passive="onScroll">
      <div
        :class="ns.e('sizer')"
        :style="{
          height: `${sizerHeight}px`,
          minWidth: `max(100%, ${contentWidth + gutterWidth}px)`,
        }"
      >
        <div
          v-if="lineNumbers || foldable || gutterCells"
          :class="ns.e('gutter')"
          aria-hidden="true"
          @pointerdown="onPointerDown($event, 'gutter')"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp($event, 'gutter')"
          @pointercancel="onPointerCancel"
          @pointerenter="gutterHover = true"
          @pointerleave="gutterHover = false"
          @mousedown.prevent
        >
          <div :class="ns.e('numbers')" :style="{ transform: `translateY(${yOf(visibleFrom)}px)` }">
            <div
              v-for="row in rows"
              :key="row.n"
              :class="[ns.e('number'), ns.is('active', row.n === activeLineNumber)]"
              :style="
                row.wrapped.breaks.length
                  ? { height: `${(row.wrapped.breaks.length + 1) * lineHeight}px` }
                  : undefined
              "
            >
              <span v-if="gutterCells" :class="ns.e('cells')">
                <span
                  v-for="(column, c) in gutterColumns"
                  :key="column.name"
                  :class="[ns.e('cell'), gutterMarkers[c]?.get(row.n)?.class]"
                  :style="{ width: `${column.width}px` }"
                  :title="gutterMarkers[c]?.get(row.n)?.title"
                  :data-gutter-cell="column.onPress ? c : undefined"
                  :data-line="row.n"
                >
                  <template v-if="gutterMarkers[c]?.get(row.n)">
                    <component
                      :is="gutterMarkers[c]!.get(row.n)!.icon"
                      v-if="gutterMarkers[c]!.get(row.n)!.icon"
                    />
                    <template v-else>{{ gutterMarkers[c]!.get(row.n)!.text }}</template>
                  </template>
                </span>
              </span>
              <template v-if="lineNumbers">{{ row.n }}</template>
              <span
                v-if="foldable && (row.folded || foldableLines.has(row.n))"
                :class="[ns.e('fold-toggle'), ns.is('folded', row.folded)]"
                :data-fold="row.n"
              >
                <ChevronRightIcon v-if="row.folded" />
                <ChevronDownIcon v-else />
              </span>
            </div>
          </div>
        </div>
        <div
          ref="content"
          :class="ns.e('content')"
          @pointerdown="onPointerDown($event, 'text')"
          @pointermove="(onPointerMove($event), onContentHover($event))"
          @pointerup="onPointerUp($event, 'text')"
          @pointercancel="onPointerCancel"
          @pointerleave="onContentLeave"
          @mousedown.prevent
        >
          <div ref="probe" :class="ns.e('probe')" aria-hidden="true" />
          <div
            v-if="activeLine && activeLineTop !== null && !disabled"
            :class="ns.e('active-line')"
            :style="{
              transform: `translateY(${activeLineTop}px)`,
              height: activeLineRows > 1 ? `${activeLineRows * lineHeight}px` : undefined,
            }"
          />
          <div :class="ns.e('matches')" aria-hidden="true">
            <div
              v-for="box in matchBoxes"
              :key="box.key"
              :class="[ns.e('match'), ns.is('current', box.current)]"
              :style="{
                transform: `translate(${box.left}px, ${box.top}px)`,
                width: `${box.width}px`,
              }"
            />
          </div>
          <div :class="ns.e('brackets')" aria-hidden="true">
            <div
              v-for="box in bracketBoxes"
              :key="box.key"
              :class="[ns.e('bracket'), ns.is('unmatched', !box.matched)]"
              :style="{
                transform: `translate(${box.left}px, ${box.top}px)`,
                width: `${box.width}px`,
              }"
            />
          </div>
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
              v-memo="[
                row.text,
                row.tokens,
                row.compose?.join('\u0000'),
                row.wrapped,
                row.folded,
                row.marksKey,
                row.lineClass,
              ]"
              :class="[ns.e('line'), ns.is('wrapped', !!row.wrapped.breaks.length), row.lineClass]"
            >
              <template v-if="row.compose"
                >{{ row.compose[0] }}<span :class="ns.e('compose')">{{ row.compose[1] }}</span
                >{{ row.compose[2] }}</template
              >
              <template v-else-if="row.wrapped.breaks.length"
                ><div
                  v-for="(_, sub) in row.wrapped.breaks.length + 1"
                  :key="sub"
                  :class="ns.e('row')"
                  :style="sub ? { paddingLeft: `${row.wrapped.indent}px` } : undefined"
                >
                  <template v-for="(part, i) in rowParts(row, sub)" :key="i"
                    ><span v-if="part[1]" :class="part[1]" :title="part[2]">{{ part[0] }}</span
                    ><template v-else>{{ part[0] }}</template></template
                  ><span
                    v-if="row.folded && sub === row.wrapped.breaks.length"
                    :class="ns.e('fold-marker')"
                    :data-unfold="row.n"
                    :title="messages.unfold"
                    >⋯</span
                  >
                </div></template
              >
              <template v-else-if="row.tokens || row.marks"
                ><template v-for="(part, i) in partsOf(row)" :key="i"
                  ><span v-if="part[1]" :class="part[1]" :title="part[2]">{{ part[0] }}</span
                  ><template v-else>{{ part[0] }}</template></template
                ></template
              >
              <template v-else>{{ row.text }}</template>
              <span
                v-if="row.folded && !row.wrapped.breaks.length"
                :class="ns.e('fold-marker')"
                :data-unfold="row.n"
                :title="messages.unfold"
                >⋯</span
              >
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
          <div
            v-for="handle in handles"
            :key="handle.kind"
            :class="[ns.e('handle'), ns.is(handle.kind, true)]"
            :style="{ transform: `translate(${handle.left}px, ${handle.top}px)` }"
            aria-hidden="true"
            @pointerdown="onHandleDown($event, handle.kind)"
          />
          <div
            v-if="magnifier"
            :class="ns.e('magnifier')"
            :style="magnifier.style"
            aria-hidden="true"
          >
            <div
              :class="ns.e('magnifier-text')"
              :style="[magnifier.textStyle, { paddingLeft: `${magnifier.indent}px` }]"
            >
              <template v-for="(part, i) in magnifier.parts" :key="i"
                ><span v-if="part[1]" :class="part[1]" :title="part[2]">{{ part[0] }}</span
                ><template v-else>{{ part[0] }}</template></template
              >
            </div>
            <div :class="ns.e('magnifier-caret')" :style="{ left: `${magnifier.caret - 1}px` }" />
          </div>
          <div
            v-if="problemStyle"
            ref="problemEl"
            :class="ns.e('problems')"
            role="group"
            :aria-label="messages.problems"
            :style="problemStyle"
            @pointerdown.stop.prevent
            @pointermove.stop
            @pointerenter="keepProblems"
            @pointerleave="onContentLeave"
          >
            <div
              v-for="(problem, i) in problemBox!.problems"
              :key="i"
              :class="[ns.e('problem-item'), ns.is(problem.severity, true)]"
            >
              <component :is="SEVERITY_ICON[problem.severity]" :class="ns.e('problem-severity')" />
              <span :class="ns.e('problem-message')"
                >{{ problem.message
                }}<span v-if="problem.source" :class="ns.e('problem-source')">
                  {{ problem.source }}</span
                ></span
              >
            </div>
            <div v-if="fixes.length" :class="ns.e('fixes')">
              <button
                v-for="(fix, i) in fixes"
                :key="i"
                type="button"
                tabindex="-1"
                :class="[ns.e('fix'), ns.is('active', i === problemBox!.index)]"
                @click="runFix(i)"
              >
                {{ fix.action.label }}
              </button>
            </div>
          </div>
          <div
            v-if="menuStyle"
            ref="menuEl"
            :class="ns.e('menu')"
            role="toolbar"
            :aria-label="messages.editMenu"
            :style="menuStyle"
            @pointerdown.stop.prevent
          >
            <button
              v-for="item in menuItems"
              :key="item.key"
              type="button"
              tabindex="-1"
              :class="ns.e('menu-button')"
              @click="item.run()"
            >
              {{ item.label }}
            </button>
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
    <div v-if="panels.bottom.length" :class="[ns.e('panels'), ns.is('bottom', true)]">
      <RenderPart v-for="panel in panels.bottom" :key="panel.key" :render="panel.render" />
    </div>
    <Teleport to="body">
      <div v-if="showKeys" :class="ns.e('keys')" :style="keysStyle">
        <CodeKeys :editor="keysEditor" :keys="keysList" :messages="messages" />
      </div>
    </Teleport>
  </div>
</template>
