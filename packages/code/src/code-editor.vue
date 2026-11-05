<script setup lang="ts">
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FunctionIcon,
  InfoIcon,
  LightbulbIcon,
  PackageIcon,
  SquareCodeIcon,
  SymbolClassIcon,
  SymbolConstantIcon,
  SymbolKeywordIcon,
  SymbolTypeAliasIcon,
  TypeIcon,
  VariableIcon,
  WrenchIcon,
  XCircleIcon,
  LetterCaseIcon,
  RegexIcon,
  WholeWordIcon,
  GripVerticalIcon,
} from '@dou-ui/icons'
import {
  DouFindReplace,
  DouToggle,
  DouTooltip,
  holdPointer,
  isApplePlatform,
  isComposing,
  scrollPositionOf,
  useLocale,
  useNamespace,
  useTeleport,
  useZIndex,
} from 'dou-ui'
import {
  computed,
  getCurrentInstance,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  shallowReactive,
  shallowRef,
  toRaw,
  type VNodeChild,
  watch,
} from 'vue'
import { matchBracket } from './core/brackets'
import { ChangeSet } from './core/changes'
import { indentOf, moveCluster, snapCluster, wordAt } from './core/chars'
import type { CodeCommand, CodeCommandTarget } from './core/commands'
import {
  deleteCharBackward,
  deleteCharForward,
  insertNewline,
  insertTab,
  insertText,
  selectAll,
} from './core/commands'
import { type CodeFold, foldEndAt, hiddenLines, mergeRanges } from './core/folding'
import { CodeHistory } from './core/history'
import {
  type CodeKeyBinding,
  buildKeymap,
  defaultKeymap,
  eventKey,
  keymapBindings,
} from './core/keymap'
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
import { holdWorker, ownWorker, SyntaxWorkerClient } from './language/worker-client'
import { format, useCodeMessages } from './locale'
import CodeKeys from './code-keys.vue'
import {
  CODE_EDITOR_KEY,
  type CodeCompletion,
  type CodeCompletionKind,
  type CodeCompletionResult,
  type CodeHoverResult,
  type CodeSignatureResult,
  type CodeDecoration,
  type CodeDiagnostic,
  type CodeDiagnosticSeverity,
  type CodeExtension,
  type CodeExtensionContext,
  type CodeGutterMarker,
  type CodeHistoryHandler,
  type CodePanel,
} from './extension'
import RenderPart from './render-part'
import { matchCompletion } from './completion/match'
import { parseSnippet } from './completion/snippet'
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
import { visibleViewport } from './view/viewport'

defineOptions({ name: 'DouCodeEditor' })

const props = withDefaults(defineProps<CodeEditorProps>(), {
  modelValue: undefined,
  doc: undefined,
  selection: undefined,
  lineNumbers: true,
  activeLine: true,
  tabSize: 2,
  language: undefined,
  worker: false,
  closeBrackets: true,
  matchBrackets: true,
  searchable: true,
  wrap: false,
  minimap: false,
  foldable: true,
  keys: true,
  messages: undefined,
  teleport: undefined,
  tabIndents: true,
  gutter: true,
  bordered: true,
})
const emit = defineEmits<CodeEditorEmits>()
const ns = useNamespace('code-editor')
const instance = getCurrentInstance()!

/** Space above the first line and below the last, and before and after each line; set from the styles once measured. */
const pad = reactive({ x: 12, y: 8 })
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

/** Steps whose changes aren't this user's typing: extensions' `transaction` hooks don't see them. */
const UNHOOKED = new Set(['undo', 'redo', 'external', 'remote'])

/** Runs every extension's `update` hook for a step that was applied. */
function notify(result: CodeTransactionResult) {
  for (const extension of extensions.value) extension.update?.(result, context)
}

function dispatch(tr: CodeTransaction): CodeTransactionResult {
  const { action } = tr.meta
  if (!UNHOOKED.has(action ?? ''))
    for (const extension of extensions.value) extension.transaction?.(tr, context)
  const result = tr.resolve()
  const before = state.value
  if (!result.changed) {
    pendingGoals = new Map()
    return result
  }
  // Someone else's change: what this user has open (menus, the problem box, the goal column) stays.
  const remote = action === 'remote'
  if (!result.changes.empty && !historyHandler.value) {
    history.record(result)
    historyTick.value++
  }
  if (!result.changes.empty) {
    if (composing.value) mapComposition(result.changes)
    syntaxChange(result.state.doc, result.changes)
    mapMatches(result.changes)
    updateWrap(before.doc, result.state.doc, result.changes)
    mapFolds(result.changes, result.state.doc)
    mapDiagnostics(result.changes, result.state.doc)
    scheduleLint()
  }
  state.value = markRaw(result.state)
  revealFolds()
  if (!remote) {
    problemBox.value = null
    // The toolbar is for the selection it opened on; typing also puts away the handle under a lone cursor.
    menuOpen.value = false
    if (!result.changes.empty) caretHandle.value = false
    goals = pendingGoals
    blink.value++
  }
  pendingGoals = new Map()
  if (!composing.value) syncInput()
  updateAssist(result)
  emitChange(result)
  notify(result)
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

function runLint(name?: string) {
  if (name === undefined) clearTimeout(lintTimer)
  const text = doc.value
  for (const extension of extensions.value) {
    if (!extension.lint || (name !== undefined && extension.name !== name)) continue
    let found: ReturnType<NonNullable<CodeExtension['lint']>>
    try {
      found = extension.lint(context)
    } catch (error) {
      console.error(`[@dou-ui/code] ${extension.name}: lint failed`, error)
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
        console.error(`[@dou-ui/code] ${extension.name}: lint failed`, error),
      )
  }
}

function scheduleLint() {
  if (!linting.value || !mounted.value) return
  clearTimeout(lintTimer)
  lintTimer = window.setTimeout(runLint, LINT_DELAY)
}

watch(extensions, (next, before) => {
  // The same extensions in a new array, as an inline `:extensions="[a]"` gives on every render: nothing to do.
  if (
    before &&
    before.length === next.length &&
    next.every((extension, i) => extension === before[i])
  )
    return
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

/** The undo history an extension brings in place of the editor's own; the first one wins. */
const historyHandler = computed<CodeHistoryHandler | null>(() => {
  for (const extension of extensions.value)
    if (extension.history) return markRaw(extension.history(context))
  return null
})
const undo = () =>
  !props.readonly &&
  (historyHandler.value ? historyHandler.value.undo() : applySteps(history.undo(), 'undo'))
const redo = () =>
  !props.readonly &&
  (historyHandler.value ? historyHandler.value.redo() : applySteps(history.redo(), 'redo'))
const closeHistory = () => (historyHandler.value ? historyHandler.value.close?.() : history.close())

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
  if (!historyHandler.value) {
    history.record(result)
    historyTick.value++
  }
  if (composing.value) mapComposition(result.changes)
  syntaxChange(result.state.doc, result.changes)
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
  notify(result)
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
  const width = viewWidth.value - gutterWidth.value - pad.x * 2 - measure.cell
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
const foldHidden = computed(() =>
  folds.value.length ? hiddenLines(doc.value, folds.value) : NOTHING_HIDDEN,
)
/** The lines extensions hide, as sorted ranges that don't overlap. */
const extensionHidden = computed(() => {
  const lines = doc.value.lines
  const ranges: Array<[number, number]> = []
  for (const extension of extensions.value) {
    if (!extension.hide) continue
    for (const { from, to } of extension.hide(context)) {
      const a = Math.max(1, Math.floor(from))
      const b = Math.min(lines, Math.floor(to))
      if (b >= a) ranges.push([a, b])
    }
  }
  return ranges.length ? mergeRanges(ranges) : NOTHING_HIDDEN
})
/** The lines not drawn: folded, or hidden by an extension. */
const hidden = computed(() => {
  const own = foldHidden.value
  const other = extensionHidden.value
  if (!other.length) return own
  if (!own.length) return other
  return mergeRanges([...own, ...other])
})
const layout = computed<LineLayout>((previous) => {
  void layoutTick.value
  const lines = doc.value.lines
  const rows = wrapRows && wrapRows.length === lines ? wrapRows : null
  // One row per line and the same count: the same layout, so nothing drawn from it is worked out again.
  if (!rows && !hidden.value.length && previous?.uniform && previous.lines === lines)
    return previous
  return markRaw(new LineLayout(lines, rows, hidden.value))
})

// ---------------------------------------------------------------- widgets between lines

/** The widgets' heights as last measured, by key. */
const widgetHeights = shallowReactive(new Map<string, number>())

interface PlacedWidget {
  key: string
  line: number
  above: boolean
  render: () => VNodeChild
  label?: string
  /** The row it sits just before: the line's first row above it, the next line's first row below it. */
  row: number
  height: number
  /** Heights of the widgets before it. */
  before: number
}

/** The extensions' widgets on lines that are drawn, in the order they sit, with their heights. */
const widgets = computed<PlacedWidget[]>(() => {
  const drawn = layout.value
  const lh = lineHeight.value
  const out: PlacedWidget[] = []
  for (const extension of extensions.value) {
    if (!extension.widgets) continue
    for (const widget of extension.widgets(context)) {
      const n =
        widget.pos !== undefined
          ? doc.value.lineAt(Math.max(0, Math.min(doc.value.length, widget.pos))).number
          : (widget.line ?? 0)
      if (n < 1 || n > drawn.lines || !drawn.shown(n)) continue
      const above = widget.position === 'above'
      const key = `${extension.name}/${widget.id}`
      out.push({
        key,
        line: n,
        above,
        render: widget.render,
        label: widget.label,
        row: drawn.rowOf(n) + (above ? 0 : drawn.rowsOf(n)),
        height: widgetHeights.get(key) ?? widget.height ?? lh,
        before: 0,
      })
    }
  }
  if (!out.length) return out
  // By row; on one row, the widget below a line before the one above the next.
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  out.sort((a, b) => a.row - b.row || Number(a.above) - Number(b.above) || a.line - b.line)
  let sum = 0
  for (const widget of out) {
    widget.before = sum
    sum += widget.height
  }
  return out
})

/** How much of the widgets' height comes before row `row`. */
function widgetsBefore(row: number) {
  const list = widgets.value
  let lo = 0
  let hi = list.length
  // The first widget past `row`; all before it come first.
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (list[mid]!.row <= row) lo = mid + 1
    else hi = mid
  }
  if (!lo) return 0
  const last = list[lo - 1]!
  return last.before + last.height
}

/** The y of row `row` from the text's top, below the widgets before it. */
const rowTop = (row: number) => row * lineHeight.value + widgetsBefore(row)

/** The row at a y from the text's top; a y over a widget gives the row right after it. */
function rowAtTextY(y: number) {
  const list = widgets.value
  const lh = lineHeight.value
  if (!list.length) return Math.floor(y / lh)
  // The last widget that starts at or before `y`.
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (list[mid]!.row * lh + list[mid]!.before <= y) lo = mid + 1
    else hi = mid
  }
  if (!lo) return Math.floor(y / lh)
  const widget = list[lo - 1]!
  const end = widget.row * lh + widget.before + widget.height
  if (y < end) return widget.row
  return widget.row + Math.floor((y - end) / lh)
}

const widgetsHeight = computed(() => {
  const list = widgets.value
  const last = list[list.length - 1]
  return last ? last.before + last.height : 0
})

const total = computed(() => layout.value.total * lineHeight.value + widgetsHeight.value)
const sizerHeight = computed(() => Math.min(total.value, MAX_HEIGHT) + pad.y * 2)
/** How much faster than the scrollbar the text moves, above `MAX_HEIGHT`. */
const ratio = computed(() => {
  if (total.value <= MAX_HEIGHT) return 1
  const view = viewHeight.value || 1
  return Math.max(1, (total.value - view) / Math.max(1, MAX_HEIGHT - view))
})
/** Offset between the text's own y and where it is drawn in the scaled scroller. */
const shift = computed(() => scrollTop.value - scrollTop.value * ratio.value)
/** The y line `n` is drawn at. */
const yOf = (line: number) => pad.y + rowTop(layout.value.rowOf(line)) + shift.value
/** The row under a y in the content, from the text's top. */
const rowAtY = (y: number) => rowAtTextY(y - pad.y - shift.value)

const visibleFrom = computed(() => {
  const top = scrollTop.value * ratio.value + (clip.value?.top ?? 0)
  const row = rowAtTextY(Math.max(0, top - pad.y)) - OVERSCAN
  return layout.value.lineAtRow(Math.max(0, row)).n
})
const visibleTo = computed(() => {
  const bottom = scrollTop.value * ratio.value + (clip.value?.bottom ?? viewHeight.value)
  const row = rowAtTextY(Math.max(0, bottom - pad.y)) + 1 + OVERSCAN
  return layout.value.lineAtRow(row).n
})

/** The widgets in view, where they are drawn. */
const shownWidgets = computed(() => {
  const list = widgets.value
  if (!list.length) return []
  const from = layout.value.rowOf(visibleFrom.value)
  const to = layout.value.rowOf(visibleTo.value) + layout.value.rowsOf(visibleTo.value)
  const lh = lineHeight.value
  return list
    .filter((widget) => widget.row >= from && widget.row <= to)
    .map((widget) => ({
      ...widget,
      top: pad.y + widget.row * lh + widget.before + shift.value,
    }))
})

/** Room left in the column of lines (and of numbers) before line `n` for the widgets there; none before the first line drawn, which is placed past them. */
function gapBefore(n: number) {
  if (n === visibleFrom.value || !widgets.value.length) return 0
  const row = layout.value.rowOf(n)
  return widgetsBefore(row) - widgetsBefore(row - 1)
}

let widgetObserver: ResizeObserver | undefined
const observedWidgets = new Map<Element, string>()
/** Measures a widget as drawn, keeping its height so the lines after it are placed below it. */
function observeWidget(el: Element | null, key: string) {
  if (!el || observedWidgets.get(el) === key) return
  observedWidgets.set(el, key)
  const measureNow = (target: Element) => {
    const id = observedWidgets.get(target)
    if (!id || !target.isConnected) return
    const height = (target as HTMLElement).offsetHeight
    // Nothing measured means no layout (a hidden editor): keep the guess.
    if (height && widgetHeights.get(id) !== height) widgetHeights.set(id, height)
  }
  measureNow(el)
  if (typeof ResizeObserver === 'undefined') return
  widgetObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) measureNow(entry.target)
    for (const [target] of observedWidgets)
      if (!target.isConnected) {
        widgetObserver!.unobserve(target)
        observedWidgets.delete(target)
      }
  })
  widgetObserver.observe(el)
}

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
  // The inline widgets before the column on its row, and one right at it: the cursor goes after them.
  if (!sub) return { top, x: measure.x(text, col) + inlineWidth(n, 0, col), sub }
  const start = wrapped.breaks[sub - 1]!
  return {
    top,
    x: wrapped.indent + measure.x(text, col) - measure.x(text, start) + inlineWidth(n, start, col),
    sub,
  }
}

/** The column nearest to `x` on row `sub` of line `n`. */
function colAt(n: number, text: string, sub: number, x: number) {
  const wrapped = wrapOf(text)
  const { breaks } = wrapped
  if (!breaks.length) return colInRow(n, text, 0, text.length, x)
  const start = sub ? breaks[sub - 1]! : 0
  const end = sub < breaks.length ? breaks[sub]! : text.length
  const col = colInRow(n, text, start, end, Math.max(0, x - (sub ? wrapped.indent : 0)))
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
    // From after the widgets at `a` to before those at `b`.
    const left = base + measure.x(text, a) + inlineWidth(n, start, a)
    const right =
      base + measure.x(text, b) + inlineWidth(n, start, b - 1) + (sub === rows - 1 ? tail : 0)
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
    onPress?: (line: number, event: PointerEvent | KeyboardEvent) => void
  }> = []
  if (!props.gutter) return columns
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
/** The line the mouse is over in the text, so the gutter can show markers waiting for it. */
const hoveredLine = ref<number | null>(null)
function lineAtY(y: number) {
  const rect = content.value?.getBoundingClientRect()
  if (!rect) return null
  return doc.value.lineAt(posAtCoords({ x: rect.left + 1, y })).number
}

/** A marker in a pressable column is a button: Enter or Space presses it. */
function onCellKeydown(event: KeyboardEvent, column: number, line: number) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const press = gutterColumns.value[column]?.onPress
  if (!press || props.disabled) return
  event.preventDefault()
  const cell = event.currentTarget as HTMLElement
  press(line, event)
  // A press that takes its marker away (removing a breakpoint) would drop the focus on the page: back to the text.
  void nextTick(() => {
    const where = document.activeElement
    const gone = !cell.isConnected || cell.getAttribute('role') !== 'button'
    if (gone && (!where || where === document.body || where === cell)) focusInput()
  })
}

/** Columns already warned about markers without a name, while developing. */
const unnamed = new Set<string>()
const gutterMarkers = computed(() =>
  gutterColumns.value.map((column) => {
    const byLine = new Map<number, CodeGutterMarker>()
    for (const marker of column.markers()) {
      byLine.set(marker.line, marker)
      if (process.env.NODE_ENV !== 'production' && column.onPress && !marker.title) {
        if (!unnamed.has(column.name))
          console.warn(
            `[@dou-ui/code] gutter "${column.name}": a marker in a column with \`onPress\` is a button and needs a \`title\` to name it.`,
          )
        unnamed.add(column.name)
      }
    }
    return byLine
  }),
)

const gutterWidth = computed(() => {
  const cells = gutterCells.value
  if (!props.gutter || (!props.lineNumbers && !props.foldable && !cells)) return 0
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
  for (const [n, own] of lineDecorations.value.inlines) {
    const text = lineText(n)
    widest = Math.max(
      widest,
      measure.x(text, text.length) + own.reduce((w, i) => w + widthOf(i), 0),
    )
  }
  return Math.ceil(widest + pad.x * 2 + measure.cell)
})

watch(wrapWidth, rebuildWrap, { immediate: true })

// ---------------------------------------------------------------- folding

/**
 * Where a fold starting at line `n` would end, or `null`; by brackets with a
 * language, else by indentation. Brackets in strings and comments count
 * only where the text has been read already, so folding a whole long text
 * doesn't read all of it first.
 */
const inStringOrComment = (pos: number) => {
  const kind = syntaxAt(pos)
  return kind === 'string' || kind === 'comment'
}

function foldEnd(n: number) {
  return foldEnds()(n)
}

/**
 * A function giving where folds end in the text as it is now, set up once
 * for asking about many lines; `lines` holds the lines' texts when the
 * caller has them.
 */
function foldEnds(texts?: readonly string[]) {
  const text = doc.value
  const hl = highlighter
  const outer = props.language
  const tabSize = props.tabSize
  const lineOf = texts ? (k: number) => texts[k - 1]! : undefined
  return (n: number) => {
    const read = !!hl?.ready(n)
    const language = outer ? ((read ? hl!.languageAt(n) : null) ?? outer) : null
    return foldEndAt(text, n, {
      brackets: language?.brackets,
      tabSize,
      skip: read ? inStringOrComment : undefined,
      lineText: lineOf,
    })
  }
}

/** The lines that start a fold, from 1. */
const foldStarts = computed(() => folds.value.map((fold) => doc.value.lineAt(fold.from).number))
watch(foldStarts, (next, prev) => {
  if (next.length !== prev.length || next.some((n, i) => n !== prev[i])) emit('foldChange', next)
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
    const endOf = foldEnds(text.lineTexts(1, text.lines))
    for (let n = 1; n < text.lines; n++) {
      const end = endOf(n)
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
/**
 * A touch screen. Read once mounted, never while rendering on the server:
 * the first render must match the server's markup, then touch-only parts show.
 */
const coarse = ref(false)
onMounted(() => {
  coarse.value = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
})
let foldCache = { doc: null as CodeText | null, ends: new Map<number, number | null>() }
const foldableLines = computed(() => {
  const out = new Set<number>()
  if (!props.foldable || !(gutterHover.value || coarse.value)) return out
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
/**
 * Changes that came in while composing (someone else's, or a new
 * `v-model`): the textarea still holds the text from before them, so what
 * it gives back is moved through these.
 */
let composeMap: ChangeSet | null = null

/** A position in the text the textarea was filled from, in the text now. */
const composedPos = (pos: number, assoc: -1 | 1) =>
  composeMap ? composeMap.mapPos(pos, assoc) : pos

function mapComposition(changes: ChangeSet) {
  composeMap = composeMap ? composeMap.compose(changes) : changes
  const shown = preview.value
  if (shown)
    preview.value = {
      ...shown,
      from: changes.mapPos(shown.from, -1),
      to: Math.max(changes.mapPos(shown.from, -1), changes.mapPos(shown.to, 1)),
    }
}

/** A class over part of a line, `from`–`to` in the line, with a title shown on hover. */
type Mark = [
  from: number,
  to: number,
  cls: string,
  title?: string,
  style?: Readonly<Record<string, string>>,
]

/** A widget inside a line, before column `col`. */
interface Inline {
  col: number
  key: string
  render: () => VNodeChild
  width?: number
}

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
  /** Widgets inside the line, by column. */
  inlines?: Inline[]
  /** Their keys and columns, as one string, to tell when they changed. */
  inlinesKey?: string
}

const rows = computed<Row[]>(() => {
  const { numbers, texts } = shownLines.value
  const p = preview.value
  const line = p ? doc.value.lineAt(p.from) : null
  const tokensOf = syntaxLines(visibleFrom.value, visibleTo.value)
  const starts = new Set(foldHidden.value.map(([from]) => from - 1))
  const { marks, lineClasses, inlines } = lineDecorations.value
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
        inlines: inlines.get(n),
        inlinesKey: inlines
          .get(n)
          ?.map((item) => `${item.col}:${item.key}`)
          .join(';'),
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
  const inlines = new Map<number, Inline[]>()
  const list = decorations.value
  const problems = diagnostics.value
  const session = snippet.value
  if (!list.length && !problems.length && !session) return { marks, lineClasses, inlines }
  const text = doc.value
  const first = visibleFrom.value
  const last = visibleTo.value
  const start = text.line(first).from
  const end = text.line(last).to
  const mark = (
    from: number,
    to: number,
    cls: string,
    title?: string,
    style?: Readonly<Record<string, string>>,
  ) => {
    if (to < start || from > end || to <= from) return
    const a = text.lineAt(Math.max(from, start))
    const b = text.lineAt(Math.min(to, end))
    for (let n = a.number; n <= b.number; n++) {
      const line = n === a.number ? a : n === b.number ? b : text.line(n)
      const x = Math.max(from, line.from) - line.from
      const y = Math.min(to, line.to) - line.from
      if (y <= x) continue
      const own = marks.get(n)
      const item: Mark = style
        ? [x, y, cls, title, style]
        : title
          ? [x, y, cls, title]
          : [x, y, cls]
      if (own) own.push(item)
      else marks.set(n, [item])
    }
  }
  for (const item of list) {
    if (item.type === 'line') {
      if (item.line < first || item.line > last) continue
      const had = lineClasses.get(item.line)
      lineClasses.set(item.line, had ? `${had} ${item.class}` : item.class)
    } else if (item.type === 'inline') {
      if (item.pos < start || item.pos > end) continue
      const line = text.lineAt(item.pos)
      const own = inlines.get(line.number) ?? []
      own.push({
        col: item.pos - line.from,
        key: item.id ?? `@${item.pos}`,
        render: item.render,
        width: item.width,
      })
      inlines.set(line.number, own)
    } else mark(item.from, item.to, item.class, item.title, item.style)
  }
  // In the order they are drawn: by column, then as given.
  for (const own of inlines.values())
    if (own.length > 1) {
      const order = new Map(own.map((item, i) => [item, i]))
      // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
      own.sort((a, b) => a.col - b.col || order.get(a)! - order.get(b)!)
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
  // The snippet's places still to fill in, after the one being filled.
  if (session)
    for (let i = session.at + 1; i < session.groups.length; i++)
      for (const range of session.groups[i]!.ranges)
        if (range.to > range.from && range.from <= end)
          mark(range.from, range.to, 'dou-code-editor__field')
  return { marks, lineClasses, inlines }
})

// ---------------------------------------------------------------- widgets inside lines

/** The widths of inline widgets as last measured, by key. */
const inlineWidths = shallowReactive(new Map<string, number>())
const widthOf = (item: Inline) => item.width ?? inlineWidths.get(item.key) ?? 0

/** Width of the inline widgets on line `n` at columns `from` to `to`, both included. */
function inlineWidth(n: number, from: number, to: number) {
  const own = lineDecorations.value.inlines.get(n)
  if (!own) return 0
  let sum = 0
  for (const item of own) if (item.col >= from && item.col <= to) sum += widthOf(item)
  return sum
}

/**
 * The column nearest to `x` (from the row's left, past its indent) on the
 * part `start`–`end` of line `n`, stepping over the inline widgets there.
 */
function colInRow(n: number, text: string, start: number, end: number, x: number) {
  const own = lineDecorations.value.inlines.get(n)
  const x0 = measure.x(text, start)
  const clamp = (col: number, low: number) => Math.max(low, Math.min(end, col))
  if (!own) return clamp(measure.col(text, x0 + x), start)
  let offset = 0
  let low = start
  for (const item of own) {
    if (item.col < start || item.col > end) continue
    const at = measure.x(text, item.col) - x0 + offset
    if (x < at) return Math.min(item.col, clamp(measure.col(text, x0 + x - offset), low))
    const width = widthOf(item)
    // Over the widget: the cursor goes on its far side, before the character it stands at.
    if (x < at + width) return item.col
    offset += width
    low = item.col
  }
  return clamp(measure.col(text, x0 + x - offset), low)
}

let inlineObserver: ResizeObserver | undefined
const observedInlines = new Map<Element, string>()
/** Measures an inline widget as drawn, keeping its width so the text after it is placed past it. */
function observeInline(el: Element | null, key: string, given: number | undefined) {
  if (!el || given !== undefined || observedInlines.get(el) === key) return
  observedInlines.set(el, key)
  const measureNow = (target: Element) => {
    const width = (target as HTMLElement).offsetWidth
    const id = observedInlines.get(target)
    if (id && target.isConnected && width && inlineWidths.get(id) !== width)
      inlineWidths.set(id, width)
  }
  measureNow(el)
  if (typeof ResizeObserver === 'undefined') return
  inlineObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) measureNow(entry.target)
    for (const [target] of observedInlines)
      if (!target.isConnected) {
        inlineObserver!.unobserve(target)
        observedInlines.delete(target)
      }
  })
  inlineObserver.observe(el)
}

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

/** The worker reading ahead, with `worker`, and how to let go of it. */
let syntaxWorker: SyntaxWorkerClient | null = null
let releaseWorker: (() => void) | null = null
let workerJob = 0

function stopSyntaxWorker() {
  syntaxWorker?.dispose()
  syntaxWorker = null
  releaseWorker?.()
  releaseWorker = null
}

/** Reading goes back to the page, saying why while developing. */
function workerFallback(message: string, error?: unknown) {
  stopSyntaxWorker()
  syntaxTick.value++
  if (process.env.NODE_ENV !== 'production')
    console.warn(
      `[@dou-ui/code] ${message}: colors are read on the page instead.`,
      ...(error ? [error] : []),
    )
}

function attachWorker(worker: Worker, release: () => void) {
  const language = props.language!
  releaseWorker = release
  syntaxWorker = new SyntaxWorkerClient(worker, language, () => doc.value, props.tabSize, {
    states(points) {
      const hl = highlighter
      if (!hl || hl.language !== language) return
      hl.adopt(points)
      syntaxTick.value++
    },
    unsupported(missing) {
      workerFallback(
        missing
          ? `the worker has no language named "${missing}" (for "${language.name}"); pass it to serveCodeHighlighting in the worker`
          : `the states of "${language.name}" can't be sent from the worker; keep them to plain data`,
      )
    },
    failed(error) {
      workerFallback('the highlighting worker failed', error)
    },
  })
  syntaxTick.value++
}

// The worker starts in the browser only, once the editor is there; the editor ends it.
watch(
  [() => props.language, () => props.worker, mounted],
  ([language, option, isMounted]) => {
    stopSyntaxWorker()
    const job = ++workerJob
    if (!language || !option || !isMounted || typeof Worker === 'undefined') return
    if (option === true) {
      ownWorker().then(
        ({ worker, release }) => {
          if (job === workerJob) attachWorker(worker, release)
          else release()
        },
        (error) =>
          job === workerJob && workerFallback('the built-in worker could not start', error),
      )
      return
    }
    let worker: Worker
    try {
      worker = option()
    } catch (error) {
      workerFallback('the worker could not start', error)
      return
    }
    attachWorker(worker, holdWorker(worker))
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  workerJob++
  stopSyntaxWorker()
})

/** Brings the colors along with a change of the text. */
function syntaxChange(next: CodeText, changes: ChangeSet) {
  highlighter?.update(next, changes)
  syntaxWorker?.change(changes)
}

/** Gets the tokens of the lines in view, asking idle time for the ones too far ahead. */
function syntaxLines(from: number, to: number): (n: number) => CodeLineTokens | null {
  void syntaxTick.value
  const hl = highlighter
  if (!hl) return () => null
  if (!hl.ready(to) && to - hl.frontier > SYNTAX_REACH) {
    if (syntaxWorker) syntaxWorker.want(hl.frontier, to)
    else scheduleSyntax(to)
    return (n) => (hl.ready(n) ? hl.line(n) : null)
  }
  return (n) => hl.line(n)
}

let syntaxJob = 0
let syntaxUntil = 0
/** Runs `task` when the page is idle, with how long it may take (ms). */
const idle =
  typeof requestIdleCallback === 'function'
    ? (task: (budget: number) => void) =>
        requestIdleCallback((deadline) => task(deadline.timeRemaining()), { timeout: 100 })
    : (task: (budget: number) => void) => window.setTimeout(() => task(8), 16)
const cancelIdle = (id: number) =>
  typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id)

function scheduleSyntax(until: number) {
  syntaxUntil = Math.max(syntaxUntil, until)
  if (syntaxJob) return
  syntaxJob = idle((budget) => {
    syntaxJob = 0
    const hl = highlighter
    if (!hl) return
    // the idle time there is, up to 20ms so a key pressed meanwhile waits little; some when it timed out
    hl.work(performance.now() + Math.min(20, Math.max(4, budget - 1)), syntaxUntil)
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

/**
 * A piece of a line, with the classes it is drawn with and the title of a
 * mark over it; or, with `inline`, the line's inline widget of that index
 * (its text empty).
 */
type Part = [
  text: string,
  cls: string | null,
  title?: string,
  inline?: number,
  style?: Readonly<Record<string, string>>,
]

/** A line cut where its tokens and marks start and end, each piece with its classes, and its inline widgets between. */
function partsOf(row: Row): Part[] {
  const parts = textParts(row)
  const own = row.inlines
  if (!own?.length) return parts
  const out: Part[] = []
  let at = 0
  let next = 0
  for (const part of parts) {
    while (next < own.length && own[next]!.col <= at) out.push(['', null, undefined, next++])
    // A widget inside the piece cuts it.
    let piece = part
    while (next < own.length && own[next]!.col < at + piece[0].length) {
      const cut = own[next]!.col - at
      out.push([piece[0].slice(0, cut), piece[1], piece[2], undefined, piece[4]])
      piece = [piece[0].slice(cut), piece[1], piece[2], undefined, piece[4]]
      at += cut
      while (next < own.length && own[next]!.col <= at) out.push(['', null, undefined, next++])
    }
    out.push(piece)
    at += piece[0].length
  }
  while (next < own.length) out.push(['', null, undefined, next++])
  return out
}

function textParts(row: Row): Part[] {
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
    let style: Readonly<Record<string, string>> | undefined
    for (const [a, b, name, label, css] of marks)
      if (a <= from && b >= to) {
        cls = cls ? `${cls} ${name}` : name
        title = label ?? title
        if (css) style = style ? { ...style, ...css } : css
      }
    const piece = row.text.slice(from, to)
    out.push(
      style
        ? [piece, cls || null, title, undefined, style]
        : title
          ? [piece, cls || null, title]
          : [piece, cls || null],
    )
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
  const last = sub === breaks.length
  for (const part of partsOf(row)) {
    const [text, type, title, inline, style] = part
    // A widget goes on the row its column starts; at the very end, on the last row.
    if (inline !== undefined) {
      if (at >= start && (at < end || (last && at === end))) out.push(part)
      continue
    }
    const from = Math.max(at, start)
    const to = Math.min(at + text.length, end)
    if (to > from) out.push([text.slice(from - at, to - at), type, title, undefined, style])
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
        left: pad.x + measure.x(lineStr, lineStr.length),
        top: yOf(at.number),
        width: 2,
      })
      return
    }
    const at = place(line.number, lineStr, pos - line.from)
    out.push({ key: `c${i}`, left: pad.x + at.x, top: at.top, width: 2 })
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
        out.push({ key: `s${i}-${n}-${k}`, ...box, left: pad.x + box.left }),
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

// Moving onto a line with widgets reads out what they are, the way problems are read out.
watch(activeLineNumber, (n) => {
  if (!focused.value || !widgets.value.length) return
  const labels = widgets.value
    .filter((widget) => widget.line === n && widget.label)
    .map((widget) => widget.label!)
  if (labels.length) announce(labels.join(' · '))
})

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
      out.push({ key: `b${pos}`, ...box, left: pad.x + box.left, matched: found.match !== null })
  }
  return out
})

// ---------------------------------------------------------------- search

const messages = useCodeMessages(() => props.messages)
const searchOpen = ref(false)
const showReplace = ref(false)
const query = ref<CodeSearchQuery>({ search: '' })
const panel = ref<InstanceType<typeof DouFindReplace>>()
const { t: common } = useLocale()
/** The toggles in the find box. */
const searchOptions = [
  { key: 'caseSensitive', icon: LetterCaseIcon },
  { key: 'wholeWord', icon: WholeWordIcon },
  { key: 'regexp', icon: RegexIcon },
] as const
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
  if (!props.searchable) return false
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
  return true
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
  announcement.value = common('findReplace.replaced', { count: all.length })
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
          left: pad.x + box.left,
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
  const lh = lineHeight.value
  const all = total.value
  const share = (pos: number) => (rowTop(drawn.rowOf(text.lineAt(pos).number)) + lh / 2) / all
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
  /** Text from the extensions' `hover`, shown above the problems. */
  info: Array<string | (() => VNodeChild)>
  /** The part of the text the box is about; the mouse may move inside it without the box changing. */
  from: number
  to: number
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
  problemBox.value = {
    pos,
    problems,
    info: [],
    ...problemsSpan(problems, pos),
    index: keyboard && hasFixes ? 0 : -1,
    keyboard,
  }
  return true
}

function problemsSpan(problems: CodeDiagnostic[], pos: number) {
  let from = pos
  let to = pos
  for (const problem of problems) {
    from = Math.min(from, problem.from)
    to = Math.max(to, problem.to)
  }
  return { from, to }
}

/** Counts requests for hover text, so an answer to an older one is dropped. */
let hoverRequest = 0
let hoverAbort: AbortController | null = null

/**
 * Shows what is known about a place: the extensions' hover text and the
 * problems there. Slow sources fill in when they answer. `false` when
 * there is nothing and nothing is coming.
 */
function showInfo(pos: number, keyboard: boolean) {
  clearTimeout(problemTimer)
  const id = ++hoverRequest
  hoverAbort?.abort()
  const abort = new AbortController()
  hoverAbort = abort
  const text = doc.value
  const problems = problemsAt(pos)
  const info: Array<string | (() => VNodeChild)> = []
  let { from, to } = problemsSpan(problems, pos)
  const line = text.lineAt(pos)
  const word = wordAt(line.text, pos - line.from)
  const add = (result: CodeHoverResult | null | undefined) => {
    if (!result) return
    info.push(result.content)
    from = Math.min(from, result.from ?? line.from + word.from)
    to = Math.max(to, result.to ?? line.from + word.to)
  }
  const apply = () => {
    if (id !== hoverRequest || doc.value !== text) return
    if (!problems.length && !info.length) {
      problemBox.value = null
      return
    }
    const hasFixes = problems.some((problem) => problem.actions?.length)
    problemBox.value = {
      pos,
      problems,
      info: info.slice(),
      from,
      to,
      index: keyboard && hasFixes ? 0 : -1,
      keyboard,
    }
    if (keyboard) {
      const said = info.filter((item) => typeof item === 'string') as string[]
      if (said.length) announce(said.join('\n'))
    }
  }
  let waiting = 0
  for (const extension of extensions.value) {
    if (!extension.hover) continue
    let answer: ReturnType<NonNullable<CodeExtension['hover']>>
    try {
      answer = extension.hover({ pos, signal: abort.signal }, context)
    } catch (error) {
      console.error(`[@dou-ui/code] ${extension.name}: hover failed`, error)
      continue
    }
    if (answer && 'then' in answer) {
      waiting++
      Promise.resolve(answer)
        .then((result) => {
          add(result)
          apply()
        })
        .catch((error: unknown) => {
          if (!abort.signal.aborted)
            console.error(`[@dou-ui/code] ${extension.name}: hover failed`, error)
        })
    } else add(answer)
  }
  apply()
  return problems.length > 0 || info.length > 0 || waiting > 0
}

/** Reads out the fix picked from the keyboard, and where it is in the list. */
function announceFix() {
  const index = problemBox.value?.index ?? -1
  const fix = fixes.value[index]
  if (!fix) return
  announce(
    format(messages.value.itemAt, {
      label: fix.action.label,
      index: index + 1,
      count: fixes.value.length,
    }),
  )
}

function closeProblems() {
  clearTimeout(problemTimer)
  hoverRequest++
  hoverAbort?.abort()
  hoverAbort = null
  problemBox.value = null
}
// The touch toolbar and the hover box would cover each other: the toolbar, asked for last, wins.
watch(menuOpen, (open) => open && closeProblems())

// A press anywhere else on the page puts the box away; inside the editor, the press decides.
function onPressAway(event: PointerEvent) {
  const at = event.target as Node | null
  if (at && (root.value?.contains(at) || problemEl.value?.contains(at))) return
  closeProblems()
}
watch(
  () => !!problemBox.value,
  (open, _old, onCleanup) => {
    if (!open || typeof window === 'undefined') return
    window.addEventListener('pointerdown', onPressAway, true)
    onCleanup(() => window.removeEventListener('pointerdown', onPressAway, true))
  },
)

/** The line whose problem icon in the gutter is under a pointer. */
function problemIconLine(event: Event) {
  const cell = (event.target as Element | null)?.closest?.(`.${ns.e('problem-icon')}`)
  const line = cell?.getAttribute('data-line')
  return line ? Number(line) : null
}

/** Shows the problems on a line, as a press on its icon in the gutter asks. */
function showLineProblems(n: number) {
  const line = doc.value.line(n)
  const first = diagnostics.value.find((problem) => problem.from >= line.from)
  if (!first || first.from > line.to) return
  menuOpen.value = false
  showInfo(first.from, false)
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
  showFixes: () => {
    if (!showProblems(mainRange(state.value.selection).head, true)) return false
    announceFix()
    return true
  },
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
    announceFix()
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
  if (event.pointerType === 'mouse') hoveredLine.value = lineAtY(event.clientY)
  if (event.pointerType !== 'mouse' || drag || problemBox.value?.keyboard) return
  const rect = content.value?.getBoundingClientRect()
  if (!rect) return
  const point = { x: event.clientX, y: event.clientY }
  const pos = posAtCoords(point)
  const at = coordsAtPos(pos)
  // Only over the text itself, not the empty space after a line.
  const over = !!at && Math.abs(point.x - at.left) <= measure.cell * 2
  const box = problemBox.value
  if (box && over && pos >= box.from && pos <= box.to) {
    clearTimeout(problemTimer)
    return
  }
  clearTimeout(problemTimer)
  // Only worth asking where there is something: a problem, or a word for the extensions to explain.
  const asks = over && (problemsAt(pos).length > 0 || extensions.value.some((e) => e.hover))
  problemTimer = window.setTimeout(
    () => (asks ? showInfo(pos, false) || closeProblems() : closeProblems()),
    asks ? 350 : 250,
  )
}

/** The mouse came onto the box: it stays. */
function keepProblems() {
  clearTimeout(problemTimer)
}

function onContentLeave(event: PointerEvent) {
  hoveredLine.value = null
  if (event.pointerType !== 'mouse' || problemBox.value?.keyboard) return
  clearTimeout(problemTimer)
  problemTimer = window.setTimeout(closeProblems, 250)
}

// Below the line, above it when there is no room, always in view.
const problemStyle = computed(() => {
  const box = problemBox.value
  return box ? floatingStyle(box.pos, problemSize.value) : null
})

/**
 * Where a box about position `pos` goes: below its line, or above it when
 * there is no room (first, with `above`), always in view; too tall for
 * either side, it scrolls inside on the roomier one.
 */
function floatingStyle(pos: number, size: { width: number; height: number }, above = false) {
  const inside = pointOf(pos)
  if (!inside) return null
  let at: { x: number; top: number } = inside
  let view = visibleBox()
  if (floatingTarget.value) {
    // Above the page: in the window's coordinates, wherever the window is scrolled.
    const page = toPage(inside)
    if (!page) return null
    at = page
    view = pageBox()
  }
  const { width, height } = size
  const lh = lineHeight.value
  // Never wider than the text area in view, on a phone too.
  const maxWidth = `${Math.max(0, Math.floor(Math.min(440, view.right - view.left - 8)))}px`
  if (above && at.top - 4 - height >= view.top) {
    const left = Math.max(view.left + 4, Math.min(at.x - 12, view.right - width - 4))
    return {
      transform: `translate(${Math.round(left)}px, ${Math.round(at.top - 4 - height)}px)`,
      maxHeight: undefined,
      maxWidth,
    }
  }
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
    maxWidth,
  }
}

/** Keeps a floating box's whole size, even while it is cut short and scrolls. */
function measureFloating(
  el: HTMLElement | undefined,
  size: { value: { width: number; height: number } },
) {
  if (el)
    size.value = {
      width: el.offsetWidth,
      height: el.scrollHeight + el.offsetHeight - el.clientHeight,
    }
}

watch([problemEl, problemBox], () => measureFloating(problemEl.value, problemSize), {
  flush: 'post',
})

// ---------------------------------------------------------------- completion

const KIND_ICON: Record<CodeCompletionKind, unknown> = {
  keyword: SymbolKeywordIcon,
  function: FunctionIcon,
  method: FunctionIcon,
  variable: VariableIcon,
  property: WrenchIcon,
  constant: SymbolConstantIcon,
  class: SymbolClassIcon,
  type: SymbolTypeAliasIcon,
  module: PackageIcon,
  snippet: SquareCodeIcon,
  text: TypeIcon,
}

interface CompletionItem {
  option: CodeCompletion
  /** Where its text goes, from here to the cursor. */
  from: number
  /** The parts of the label that were typed. */
  ranges: Array<[number, number]>
  score: number
}

/** The open completion list: the answers it came from, and the entries that match what is typed. */
const completion = shallowRef<{
  pos: number
  results: CodeCompletionResult[]
  items: CompletionItem[]
  index: number
  explicit: boolean
  /** Picked from with the keys, not just opened by typing. */
  moved: boolean
} | null>(null)
const completionEl = ref<HTMLElement>()
const completionList = ref<HTMLElement>()
const completionSize = ref({ width: 0, height: 0 })
const completionId = `dou-code-completion-${instance.uid}`
const hasCompletion = computed(() => extensions.value.some((extension) => extension.completion))
let completionRequest = 0
let completionAbort: AbortController | null = null

const WORD_BEFORE = /[\p{L}\p{N}_$]+$/u
const WORD_CHAR = /[\p{L}\p{N}_$]/u

/** The word right before `pos`. */
function wordBefore(pos: number) {
  const line = doc.value.lineAt(pos)
  const found = WORD_BEFORE.exec(line.text.slice(0, pos - line.from))
  const text = found ? found[0] : ''
  return { from: pos - text.length, to: pos, text }
}

/** The answers' entries that match what is typed since each answer's `from`, best first. */
function rankCompletions(results: readonly CodeCompletionResult[], pos: number) {
  const out: CompletionItem[] = []
  const text = doc.value
  for (const result of results) {
    if (result.from > pos || result.from < 0) continue
    const typed = text.slice(result.from, pos)
    for (const option of result.options) {
      const match = matchCompletion(option.label, typed)
      if (match)
        out.push({
          option,
          from: result.from,
          ranges: match.ranges,
          score: match.score + (option.boost ?? 0),
        })
    }
  }
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  out.sort((a, b) => b.score - a.score || a.option.label.localeCompare(b.option.label))
  return out.length > 200 ? out.slice(0, 200) : out
}

/** Asks the extensions for completions at the cursor and opens the list with what matches. */
function startCompletion(explicit: boolean) {
  const main = mainRange(state.value.selection)
  const sources = extensions.value.filter((extension) => extension.completion)
  if (!sources.length || !isEmptyRange(main) || props.readonly || props.disabled) {
    closeCompletion()
    return false
  }
  const pos = main.head
  const id = ++completionRequest
  completionAbort?.abort()
  const abort = new AbortController()
  completionAbort = abort
  const text = doc.value
  const request = { pos, word: wordBefore(pos), explicit, signal: abort.signal }
  // Until the new answers come, the last ones go on matching what is typed.
  const previous = completion.value?.results ?? []
  const results: CodeCompletionResult[] = []
  let waiting = 0
  const apply = () => {
    if (id !== completionRequest || doc.value !== text) return
    if (mainRange(state.value.selection).head !== pos) return
    const source = results.length || !waiting ? results : previous
    const items = rankCompletions(source, pos)
    // The word is already all there: nothing to complete, unless asked.
    const done =
      !explicit && items.length === 1 && text.slice(items[0]!.from, pos) === items[0]!.option.label
    if (!items.length || done) {
      if (!waiting) completion.value = null
      return
    }
    const before = completion.value
    const picked = before?.items[before.index]?.option
    const kept = picked ? items.findIndex((item) => item.option === picked) : -1
    completion.value = {
      pos,
      results: source,
      items,
      index: Math.max(0, kept),
      explicit,
      moved: kept > 0 && !!before?.moved,
    }
    // A list that opens is read out with its first entry; the textarea is not a combobox to some readers.
    if (!before) announceCompletion()
  }
  for (const extension of sources) {
    let answer: ReturnType<NonNullable<CodeExtension['completion']>>
    try {
      answer = extension.completion!(request, context)
    } catch (error) {
      console.error(`[@dou-ui/code] ${extension.name}: completion failed`, error)
      continue
    }
    if (answer && 'then' in answer) {
      waiting++
      Promise.resolve(answer)
        .then((result) => {
          waiting--
          if (result) results.push(result)
          apply()
        })
        .catch((error: unknown) => {
          waiting--
          if (!abort.signal.aborted)
            console.error(`[@dou-ui/code] ${extension.name}: completion failed`, error)
          apply()
        })
    } else if (answer) results.push(answer)
  }
  apply()
  return true
}

function closeCompletion() {
  completionRequest++
  completionAbort?.abort()
  completionAbort = null
  completion.value = null
}

function moveCompletion(step: number) {
  const list = completion.value
  if (!list) return
  const count = list.items.length
  // Arrows go round; pages stop at the ends.
  const index =
    Math.abs(step) === 1
      ? (list.index + step + count) % count
      : Math.max(0, Math.min(count - 1, list.index + step))
  completion.value = { ...list, index, moved: true }
  announceCompletion()
  nextTick(() =>
    completionList.value
      ?.querySelector(`#${completionId}-${index}`)
      ?.scrollIntoView?.({ block: 'nearest' }),
  )
}

/** Reads out the picked entry, and where it is in the list. */
function announceCompletion() {
  const list = completion.value
  const item = list?.items[list.index]
  if (!item) return
  announce(
    format(messages.value.itemAt, {
      label: item.option.detail ? `${item.option.label} ${item.option.detail}` : item.option.label,
      index: list.index + 1,
      count: list.items.length,
    }),
  )
}

/** Puts the entry's text in place of what was typed for it. */
function acceptCompletion(index: number) {
  const list = completion.value
  const item = list?.items[index]
  if (!item) return
  closeCompletion()
  const pos = mainRange(state.value.selection).head
  const { option } = item
  if (option.snippet !== undefined) insertSnippet(item.from, pos, option.snippet)
  else {
    const insert = option.insert ?? option.label
    dispatch(
      transaction()
        .replace(item.from, pos, insert)
        .select(item.from + insert.length)
        .setMeta({ action: 'complete', scroll: true }),
    )
  }
  focusInput()
}

/** Keys while the list is open: arrows and pages pick, Enter or Tab puts the entry in, Escape closes it. */
function completionKey(name: string) {
  if (!completion.value) return false
  if (name === 'arrowdown' || name === 'arrowup') moveCompletion(name === 'arrowdown' ? 1 : -1)
  else if (name === 'pagedown' || name === 'pageup') moveCompletion(name === 'pagedown' ? 8 : -8)
  else if (
    name === 'tab' &&
    snippet.value &&
    !completion.value.moved &&
    !completion.value.explicit
  ) {
    // Inside a snippet, Tab goes on to the next place unless an entry was picked with the keys.
    closeCompletion()
    return false
  } else if (name === 'enter' || name === 'tab') acceptCompletion(completion.value.index)
  else if (name === 'escape') closeCompletion()
  else return false
  return true
}

/** A label cut where the typed characters start and end. */
function labelParts(item: CompletionItem) {
  const { label } = item.option
  const out: Array<[string, boolean]> = []
  let at = 0
  for (const [from, to] of item.ranges) {
    if (from > at) out.push([label.slice(at, from), false])
    out.push([label.slice(from, to), true])
    at = to
  }
  if (at < label.length) out.push([label.slice(at), false])
  return out
}

const completionStyle = computed(() => {
  const list = completion.value
  if (!list) return null
  const first = list.items[list.index]?.from ?? list.pos
  return floatingStyle(first, completionSize.value)
})
watch(
  [completionEl, completion],
  () => {
    const el = completionEl.value
    const list = completionList.value
    // Its whole height: the list scrolls when the box is cut short.
    if (el && list)
      completionSize.value = {
        width: el.offsetWidth,
        height: el.offsetHeight + list.scrollHeight - list.clientHeight,
      }
  },
  { flush: 'post' },
)

// ---------------------------------------------------------------- snippets

/** The snippet being filled in: its places, grouped by number in Tab order, and which one is selected. */
const snippet = shallowRef<{
  groups: Array<{ index: number; ranges: Array<{ from: number; to: number }> }>
  at: number
  /** Where the snippet ends, for the cursor once all its places are filled in. */
  end: number
} | null>(null)

/** Inserts a snippet in place of `from`–`to`, its later lines indented like the first, and selects its first place. */
function insertSnippet(from: number, to: number, source: string) {
  const line = doc.value.lineAt(from)
  const indent = indentOf(line.text)
  // A tab in a snippet is one step of indent, as the editor indents.
  const unit = props.indentWithTabs ? '\t' : ' '.repeat(props.tabSize)
  const own = source.replace(/\t/g, unit)
  const { text, fields } = parseSnippet(indent ? own.replace(/\n/g, `\n${indent}`) : own)
  const groups: Array<{ index: number; ranges: Array<{ from: number; to: number }> }> = []
  for (const field of fields) {
    const range = { from: from + field.from, to: from + field.to }
    const group = groups.find((g) => g.index === field.index)
    if (group) group.ranges.push(range)
    else groups.push({ index: field.index, ranges: [range] })
  }
  const tr = transaction().replace(from, to, text).setMeta({ action: 'complete', scroll: true })
  if (!groups.length) {
    snippet.value = null
    dispatch(tr.select(from + text.length))
    return
  }
  const first = groups[0]!
  tr.select({ ranges: first.ranges.map((r) => ({ anchor: r.from, head: r.to })), main: 0 })
  dispatch(tr)
  // Its places are in the new text already, so set after the change. Nothing more to fill in once there: no session to keep.
  snippet.value =
    groups.length > 1 || first.index !== 0 ? { groups, at: 0, end: from + text.length } : null
}

/** Selects the next or previous place of the snippet; past the last, the snippet is done. */
function snippetField(dir: 1 | -1) {
  const session = snippet.value
  if (!session) return false
  const next = Math.max(0, session.at + dir)
  const group = session.groups[next]
  if (!group) {
    // Past the last place, with no $0: done, the cursor after the snippet.
    snippet.value = null
    dispatch(transaction().select(session.end).setMeta({ action: 'snippet', scroll: true }))
    return true
  }
  // $0 is where it ends: reaching it is done.
  snippet.value = group.index === 0 ? null : { ...session, at: next }
  dispatch(
    transaction()
      .select({ ranges: group.ranges.map((r) => ({ anchor: r.from, head: r.to })), main: 0 })
      .setMeta({ action: 'snippet', scroll: true }),
  )
  return true
}

// ---------------------------------------------------------------- parameter hints

const signature = shallowRef<{ pos: number; result: CodeSignatureResult } | null>(null)
const signatureEl = ref<HTMLElement>()
const signatureSize = ref({ width: 0, height: 0 })

let signatureRequest = 0
let signatureAbort: AbortController | null = null

/** Asks the extensions about the call around the cursor; the first answer, by priority, is shown. */
function updateSignature() {
  const id = ++signatureRequest
  signatureAbort?.abort()
  const abort = new AbortController()
  signatureAbort = abort
  // At the head, also with a snippet's place selected.
  const pos = mainRange(state.value.selection).head
  const text = doc.value
  type Answer = ReturnType<NonNullable<CodeExtension['signature']>>
  const answers: Answer[] = []
  for (const extension of extensions.value) {
    if (!extension.signature) continue
    try {
      const answer = extension.signature({ pos, signal: abort.signal }, context)
      if (answer && 'then' in answer)
        answers.push(
          Promise.resolve(answer).catch((error: unknown) => {
            if (!abort.signal.aborted)
              console.error(`[@dou-ui/code] ${extension.name}: signature failed`, error)
            return null
          }),
        )
      else answers.push(answer)
    } catch (error) {
      console.error(`[@dou-ui/code] ${extension.name}: signature failed`, error)
    }
  }
  const show = (result: CodeSignatureResult | null | undefined) => {
    if (id !== signatureRequest || doc.value !== text) return
    if (mainRange(state.value.selection).head !== pos) return
    if (!result) {
      signature.value = null
      return
    }
    const before = signature.value?.result
    signature.value = { pos, result }
    // Read out when the parameter changes, not on every key.
    if (!before || before.label !== result.label || before.active !== result.active) {
      const param = result.params[result.active]
      announce(param ? result.label.slice(param[0], param[1]) : result.label)
    }
  }
  // The first answer in priority order; a slow one is waited for, the box staying as it was meanwhile.
  let i = 0
  const next = (): void => {
    for (; i < answers.length; i++) {
      const answer = answers[i]
      if (answer && 'then' in answer) {
        const at = i
        void answer.then((result) => {
          answers[at] = result
          next()
        })
        return
      }
      if (answer) return show(answer)
    }
    show(null)
  }
  next()
}

function closeSignature() {
  signatureRequest++
  signatureAbort?.abort()
  signatureAbort = null
  signature.value = null
}

const signatureParts = computed(() => {
  const result = signature.value?.result
  if (!result) return []
  const param = result.params[result.active]
  if (!param) return [[result.label, false]] as Array<[string, boolean]>
  return [
    [result.label.slice(0, param[0]), false],
    [result.label.slice(param[0], param[1]), true],
    [result.label.slice(param[1]), false],
  ] as Array<[string, boolean]>
})

const signatureStyle = computed(() => {
  const box = signature.value
  return box ? floatingStyle(box.pos, signatureSize.value, true) : null
})
watch([signatureEl, signature], () => measureFloating(signatureEl.value, signatureSize), {
  flush: 'post',
})

const teleport = useTeleport(() => props.teleport)
/**
 * Where the boxes about the text and the touch handles render: above the
 * page by default, so a short editor never cuts them off; inside the frame
 * (`null`) when `teleport` is `false`, and until the editor is mounted.
 */
const floatingTarget = computed(() =>
  // Only once mounted: the server's markup keeps them in place, so hydrating never looks for them in the body.
  teleport.value.disabled || !mounted.value ? null : teleport.value.to,
)
const floatingZ = ref(0)
const floatingEl = ref<HTMLElement>()
/**
 * The layer above the page sits in the page, not fixed to the window, so it
 * scrolls with the page on its own and never lags behind a finger's scroll.
 * Its boxes are placed in the window's coordinates; this moves the layer so
 * those land where the window has them, as of the last scroll.
 */
const layerShift = ref({ x: 0, y: 0 })
function readLayerShift() {
  const el = floatingEl.value
  if (!el || !floatingTarget.value) return
  const rect = el.getBoundingClientRect()
  const { x, y } = layerShift.value
  layerShift.value = { x: x - rect.left, y: y - rect.top }
}
/** Bumped when the page scrolls or resizes, for boxes placed in the window's coordinates. */
const viewportTick = ref(0)
const bumpViewport = () => {
  readLayerShift()
  viewportTick.value++
}
/**
 * A box the editor sits in scrolling (a drawer, a side panel, an app's main
 * area): the layer above the page scrolls with the page only, so it hides
 * until that box stops, rather than trail behind the text.
 */
const boxScrolling = ref(false)
let boxScrollTimer = 0
/**
 * How the editor moves when the page scrolls, read as the layer opens: with
 * the page; not at all, inside a `fixed` box (a bar pinned to the bottom, a
 * panel), where the layer stays fixed too; or partly, inside a `sticky` box,
 * where the layer hides while the page scrolls.
 */
const anchorMode = ref<'page' | 'fixed' | 'sticky'>('page')
function readAnchorMode() {
  let mode: 'page' | 'fixed' | 'sticky' = 'page'
  for (let el = root.value?.parentElement; el && el !== document.body; el = el.parentElement) {
    const { position } = getComputedStyle(el)
    if (position === 'fixed') {
      mode = 'fixed'
      break
    }
    if (position === 'sticky') mode = 'sticky'
  }
  anchorMode.value = mode
}
function onAnyScroll(event: Event) {
  const box = event.target
  const page = !(box instanceof Element)
  if (
    page
      ? anchorMode.value === 'sticky'
      : box !== scroller.value && !!root.value && box.contains(root.value)
  ) {
    boxScrolling.value = true
    clearTimeout(boxScrollTimer)
    boxScrollTimer = window.setTimeout(() => (boxScrolling.value = false), 160)
  }
  bumpViewport()
}
/** Whether the focus is on the bar of keys itself, reached by Escape then Tab: the bar stays while it is. */
const keysFocused = ref(false)
/** The bar of keys, on a touch screen while the editor takes input, or while the focus is on it. */
const showKeys = computed(
  () =>
    !!props.keys &&
    coarse.value &&
    (focused.value || keysFocused.value) &&
    !props.readonly &&
    !props.disabled,
)
const floatingOpen = computed(
  () =>
    !!(problemBox.value || completion.value || signature.value) ||
    (touchUi.value && focused.value) ||
    showKeys.value,
)
watch(floatingOpen, (open, _old, onCleanup) => {
  if (!open || typeof window === 'undefined') return
  floatingZ.value = nextZIndex()
  // The boxes above the page take the editor's own variables with them, as they are now.
  readFrameFont()
  readAnchorMode()
  readLayerShift()
  // Once fixed or not as read, from where the layer now is.
  void nextTick(bumpViewport)
  const vv = window.visualViewport
  window.addEventListener('scroll', onAnyScroll, { capture: true, passive: true })
  window.addEventListener('resize', bumpViewport, { passive: true })
  vv?.addEventListener('resize', bumpViewport, { passive: true })
  vv?.addEventListener('scroll', bumpViewport, { passive: true })
  onCleanup(() => {
    window.removeEventListener('scroll', onAnyScroll, { capture: true })
    clearTimeout(boxScrollTimer)
    boxScrolling.value = false
    window.removeEventListener('resize', bumpViewport)
    vv?.removeEventListener('resize', bumpViewport)
    vv?.removeEventListener('scroll', bumpViewport)
  })
})

/** Where a point of the content is in the window; `null` while it is out of the editor's view. */
function toPage(inside: { x: number; top: number }) {
  void viewportTick.value
  const view = visibleBox()
  if (inside.top + lineHeight.value <= view.top || inside.top >= view.bottom) return null
  if (inside.x < view.left - 1 || inside.x > view.right + 1) return null
  const rect = content.value?.getBoundingClientRect()
  if (!rect) return null
  return { x: rect.left + inside.x, top: rect.top + inside.top }
}

/** The editor's text in view, in the window's coordinates. */
function frameInPage() {
  void viewportTick.value
  const view = visibleBox()
  const rect = content.value?.getBoundingClientRect()
  const x = rect?.left ?? 0
  const y = rect?.top ?? 0
  return { left: x + view.left, top: y + view.top, right: x + view.right, bottom: y + view.bottom }
}

/**
 * The part of the page in view, in the window's coordinates: on a phone,
 * above the keyboard and the bar of keys over it.
 */
function pageBox() {
  void viewportTick.value
  const { left, top, width, height } = visibleViewport()
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
  }
}

/** After each change: opens, updates or closes the completion list and the parameter hints, and moves the snippet's places. */
function updateAssist(result: CodeTransactionResult) {
  const { action } = result.meta
  const { changes } = result
  const main = mainRange(result.state.selection)
  const session = snippet.value
  if (session) {
    const groups = changes.empty
      ? session.groups
      : session.groups.map((group) => ({
          index: group.index,
          ranges: group.ranges.map((range) => ({
            from: changes.mapPos(range.from, -1),
            to: changes.mapPos(range.to, 1),
          })),
        }))
    // Leaving the place being filled in ends the snippet.
    const current = groups[session.at]
    const inside = current?.ranges.some((range) => main.head >= range.from && main.head <= range.to)
    const end = changes.empty ? session.end : changes.mapPos(session.end, 1)
    snippet.value =
      action === 'snippet' || action === 'complete' || inside ? { ...session, groups, end } : null
  }
  if (action === 'remote') {
    // Someone else's change: the list and the hints stay, unless it reached what they are about.
    if (changes.empty) return
    const head = mainRange(result.before.selection).head
    const map = (pos: number) => changes.mapPos(pos, -1)
    const list = completion.value
    if (list) {
      const start = Math.min(list.pos, ...list.results.map((answer) => answer.from))
      if (changes.touches(Math.min(start, head), Math.max(list.pos, head))) closeCompletion()
      else
        completion.value = {
          ...list,
          pos: map(list.pos),
          results: list.results.map((answer) => ({ ...answer, from: map(answer.from) })),
          items: list.items.map((item) => ({ ...item, from: map(item.from) })),
        }
    }
    const hints = signature.value
    if (hints)
      if (changes.touches(Math.min(hints.pos, head), Math.max(hints.pos, head))) updateSignature()
      else signature.value = { ...hints, pos: map(hints.pos) }
    return
  }
  if (action === 'complete' || action === 'snippet') {
    // A completed call puts the cursor inside its brackets: the hints show right away.
    updateSignature()
    return
  }
  if (action === 'input' && !changes.empty && result.state.selection.ranges.length === 1) {
    // What was typed, also when a closing bracket came in after it.
    const ch = changes.changes[changes.changes.length - 1]!.insert
      ? result.state.doc.slice(main.head - 1, main.head)
      : ''
    const trigger = extensions.value.some((extension) => extension.completionTriggers?.includes(ch))
    if (ch && (WORD_CHAR.test(ch) || trigger)) startCompletion(false)
    else closeCompletion()
    if (signature.value || ch === '(' || ch === ',') updateSignature()
    return
  }
  if (action === 'delete' && completion.value && wordBefore(main.head).text)
    startCompletion(completion.value.explicit)
  else closeCompletion()
  if (signature.value) updateSignature()
}

/** Where the problems sit along the scrollbar, by severity. */
const problemMarks = computed(() => {
  const list = diagnostics.value
  if (!list.length) return []
  const text = doc.value
  const drawn = layout.value
  const lh = lineHeight.value
  const all = total.value
  const taken = new Set<string>()
  const out: Array<{ top: number; severity: CodeDiagnosticSeverity }> = []
  for (const problem of list) {
    const y = rowTop(drawn.rowOf(text.lineAt(problem.from).number)) + lh / 2
    const top = Math.round((y / all) * 1000) / 10
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
  const top: Array<{ key: string; render: CodePanel['render'] }> = []
  const bottom: typeof top = []
  for (const extension of extensions.value)
    for (const bar of extension.panels?.(context) ?? [])
      (bar.position === 'top' ? top : bottom).push({
        key: `${extension.name}/${bar.name}`,
        render: bar.render,
      })
  return { top, bottom }
})

const searchControl = {
  open: (replace?: boolean) => openSearch(replace),
  close: closeSearch,
  next: () => nextMatch(),
  previous: () => previousMatch(),
}

// ---------------------------------------------------------------- the hidden textarea

/**
 * What the textarea holds: the text from `from` to `to`, and the caret
 * inside it. `selected` is the selection its caret stands for, on a touch
 * screen: whatever the textarea is given there replaces it.
 */
let mirror: {
  from: number
  to: number
  value: string
  start: number
  end: number
  selected: { from: number; to: number } | null
} = { from: 0, to: 0, value: '', start: 0, end: 0, selected: null }
const inputBox = ref({ top: pad.y, left: pad.x, height: 20 })

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
  let start = Math.max(0, Math.min(rangeFrom(main), to) - from)
  const end = Math.max(0, Math.min(rangeTo(main), to) - from)
  // On a touch screen the textarea keeps only a caret, at the selection's end: a selection
  // there would bring the system's own handles and menu up over the editor's.
  const selected =
    coarse.value && !isEmptyRange(main) ? { from: rangeFrom(main), to: rangeTo(main) } : null
  if (selected) start = end
  mirror = { from, to, value, start, end, selected }
  composeMap = null
  // Put the textarea where its caret lines up with the drawn main cursor, so input methods open there.
  const startLine = text.lineAt(from)
  const headLine = text.lineAt(main.head)
  const headText = headLine.number === startLine.number ? startLine.text : headLine.text
  const caret = place(headLine.number, headText, main.head - headLine.from)
  const lineStart = headLine.number === startLine.number ? from - startLine.from : 0
  inputBox.value = {
    top: caret.top - (headLine.number - startLine.number) * lineHeight.value,
    left:
      pad.x +
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

/** The text a change in the textarea replaces: the part it changed, or the selection its caret stands for. */
function inputRange(diff: { from: number; to: number }) {
  const { selected } = mirror
  const from = composedPos(selected ? selected.from : mirror.from + diff.from, -1)
  const to = Math.max(from, composedPos(selected ? selected.to : mirror.from + diff.to, 1))
  return { from, to }
}

/** Turns what the textarea now holds into a change of the text. */
function readInput() {
  const el = input.value
  if (!el || props.readonly) return
  const diff = diffText(mirror.value, el.value, mirror.start)
  if (!diff) return
  const { from, to } = inputRange(diff)
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
  // The caret standing for the selection deleted something: the selection goes.
  if (mirror.selected && !insert && from === rangeFrom(main) && to === rangeTo(main))
    return run(deleteCharBackward)
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
  if (mirror.selected) {
    dispatch(tr.select(from + insert.length))
    return
  }
  const result = tr.resolve()
  const base = composedPos(mirror.from, 1)
  const caret = (offset: number) => base + offset
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
    if (!diff) {
      preview.value = null
      return
    }
    preview.value = { ...inputRange(diff), insert: diff.insert }
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
  assist: {
    complete: () => startCompletion(true),
    hover: () => showInfo(mainRange(state.value.selection).head, true),
    field: (dir) => snippetField(dir),
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
    head = next.from + colAt(next.number, next.text, sub, goal)
  }
  pendingGoals.set(head, goal)
  return head
}

/** The extensions' keys, lowest priority first, since later bindings are tried first. */
function extensionKeys() {
  const list = extensions.value
  const out: CodeKeyBinding[] = []
  for (let i = list.length - 1; i >= 0; i--) out.push(...keymapBindings(list[i]!.keymap?.(context)))
  return out
}

const keymap = computed(() =>
  buildKeymap(
    [
      // Without indenting, Tab is left to the browser, but still fills in snippets.
      ...(props.tabIndents ? defaultKeymap : defaultKeymap.filter((b) => b.run !== insertTab)),
      ...extensionKeys(),
      ...keymapBindings(props.keymap),
    ],
    apple,
  ),
)
/** After Escape, Tab leaves the editor instead of indenting, so keyboard users are never stuck. */
let tabLeaves = false
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

/** When Enter last confirmed a composition; some browsers also put a line break into the textarea for it, right after. */
let confirmEnter = -Infinity

function onKeydown(event: KeyboardEvent) {
  if (isComposing(event) || composing.value) {
    if (event.key === 'Enter') confirmEnter = performance.now()
    return
  }
  confirmEnter = -Infinity
  const name = eventKey(event, apple)
  if (completionKey(name) || problemKey(name)) {
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
  // Escape also ends filling in a snippet.
  if (name === 'escape' && snippet.value) {
    snippet.value = null
    event.preventDefault()
    event.stopPropagation()
    return
  }
  const leaving = tabLeaves && (name === 'tab' || name === 'shift+tab')
  // Shift pressed on its way to Shift+Tab comes down on its own first
  if (!MODIFIERS.has(event.key)) tabLeaves = name === 'escape'
  if (leaving) {
    // Tab goes on to the bar of keys first, which sits elsewhere in the page.
    const first =
      name === 'tab' && !shownWidgets.value.length ? keysEl.value?.querySelector('button') : null
    if (first) {
      event.preventDefault()
      first.focus()
    }
    return
  }
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
  return line.from + colAt(n, line.text, sub, point.x - rect.left - pad.x)
}

function coordsAtPos(pos: number) {
  const rect = content.value?.getBoundingClientRect()
  if (!rect) return null
  const line = doc.value.lineAt(pos)
  if (!isShown(line.number)) return null
  const at = place(line.number, line.text, pos - line.from)
  const top = rect.top + at.top
  return { left: rect.left + pad.x + at.x, top, bottom: top + lineHeight.value }
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
  return { n, x: Math.max(0, point.x - rect.left - pad.x) }
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
  // A click on a problem's icon shows it; a finger's tap does, once it ends in place.
  const iconLine = area === 'gutter' ? problemIconLine(event) : null
  if (iconLine !== null && event.pointerType === 'mouse') {
    event.preventDefault()
    showLineProblems(iconLine)
    return
  }
  if (event.pointerType !== 'mouse') {
    onPointerCancel()
    const x = event.clientX
    const y = event.clientY
    touch = {
      x,
      y,
      pointer: event.pointerId,
      // Lets go when the finger lifts unheard (Safari can send its `pointerup` to a removed line).
      hold: holdPointer(event, root.value, () => {
        onPointerCancel()
        endDrag()
      }),
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
  const iconLine = area === 'gutter' ? problemIconLine(event) : null
  if (iconLine !== null) return showLineProblems(iconLine)
  const pos = posAtCoords({ x: event.clientX, y: event.clientY })
  const main = mainRange(state.value.selection)
  // A tap on the cursor itself opens the toolbar, or puts it away.
  const onCursor =
    area === 'text' && focused.value && isEmptyRange(main) && main.head === pos && caretHandle.value
  const wasOpen = menuOpen.value
  // A problem under the cursor is shown first; a tap with it already shown brings the toolbar.
  const showsProblem = area === 'text' && problemsAt(pos).length > 0 && !problemBox.value
  touchUi.value = true
  select(area === 'gutter' ? 'line' : 'char', pos, false)
  caretHandle.value = area === 'text'
  menuOpen.value = area === 'gutter' || (onCursor && !wasOpen && !showsProblem)
  // A tap on a problem shows it, the way hovering does with a mouse.
  if (area === 'text' && !menuOpen.value) showInfo(pos, false)
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
  return { x: pad.x + at.x, top: at.top, sub: at.sub, n: line.number }
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
    const inside = pointOf(pos)
    // Above the page, a handle shows only while its end is in the editor's view.
    const at = inside && floatingTarget.value ? toPage(inside) : inside
    if (at) out.push({ kind, left: Math.round(at.x), top: Math.round(at.top + lineHeight.value) })
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
  const hold = holdPointer(event, root.value, () => {
    clearHandlePress()
    endDrag()
  })
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
  if (press.kind !== 'caret') return
  // The handle reaches over the next line: a tap there is for that line's text, as if the handle were not there.
  const pos = posAtCoords({ x: event.clientX, y: event.clientY })
  const line = doc.value.lineAt(pos).number
  if (line !== doc.value.lineAt(mainRange(state.value.selection).head).number) {
    select('char', pos, false)
    menuOpen.value = false
    showInfo(pos, false)
    return focusInput()
  }
  // A tap on the handle under the cursor opens the toolbar, or puts it away.
  menuOpen.value = !menuOpen.value
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
  for (const extension of extensions.value) {
    if (!extension.menu) continue
    extension.menu(context).forEach((item, i) =>
      items.push({
        key: `${extension.name}/${i}`,
        label: item.label,
        run: () => {
          menuOpen.value = false
          item.run(context)
        },
      }),
    )
  }
  return items
})

// Above the selection; below it (past its handle) when there is no room; always in view.
const menuStyle = computed(() => {
  if (!menuItems.value.length) return null
  const main = mainRange(state.value.selection)
  let start = pointOf(rangeFrom(main))
  let end = pointOf(rangeTo(main))
  let view = visibleBox()
  let frame = view
  if (floatingTarget.value) {
    start = start && toPage(start) && { ...start, ...toPage(start)! }
    end = end && toPage(end) && { ...end, ...toPage(end)! }
    view = pageBox()
    frame = frameInPage()
  }
  if (!start && !end) return null
  const { width, height } = menuSize.value
  const lh = lineHeight.value
  const sameRow = start && end && start.top === end.top
  const x = sameRow ? (start!.x + end!.x) / 2 : (frame.left + frame.right) / 2
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

/** The editor's variables the boxes use, carried to them when they are drawn above the page. */
const FRAME_VARS = [
  '--dou-code-editor-font-size',
  '--dou-code-editor-line-height',
  '--dou-code-editor-bg',
  '--dou-code-editor-error',
  '--dou-code-editor-warning',
  '--dou-code-editor-info',
  '--dou-code-editor-selection',
] as const
const frameVars = shallowRef<Record<string, string>>({})
/** The editor's font, for the magnifier when it is drawn above the page. */
const frameFont = shallowRef<Record<string, string>>({})
function readFrameFont() {
  const el = root.value
  if (!el) return
  const style = getComputedStyle(el)
  const vars: Record<string, string> = {}
  for (const name of FRAME_VARS) {
    const value = style.getPropertyValue(name).trim()
    if (value) vars[name] = value
  }
  frameVars.value = vars
  frameFont.value = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    '--dou-code-editor-line-height': `${lineHeight.value}px`,
    '--dou-code-editor-tab-size': String(props.tabSize),
  }
}

/** The magnifier over a finger dragging the selection: the row at the moving end, larger. */
const MAGNIFIER = { width: 128, scale: 1.5 }
const magnifier = computed(() => {
  if (!touchDrag.value) return null
  void metrics.value
  const head = mainRange(state.value.selection).head
  const inside = pointOf(head)
  if (!inside) return null
  const row = rows.value.find((r) => r.n === inside.n)
  if (!row) return null
  const outside = !!floatingTarget.value
  const page = outside ? toPage(inside) : inside
  if (!page) return null
  const at = { ...inside, x: page.x, top: page.top }
  const lh = lineHeight.value
  const height = Math.round(lh * MAGNIFIER.scale) + 8
  const view = outside ? pageBox() : visibleBox()
  const { width } = MAGNIFIER
  const above = at.top - GAP - height
  const top = above >= view.top + 4 ? above : at.top + lh + HANDLE + GAP
  const left = Math.max(view.left + 4, Math.min(at.x - width / 2, view.right - width - 4))
  const parts = row.wrapped.breaks.length
    ? rowParts(row, at.sub)
    : row.tokens || row.marks || row.inlines
      ? partsOf(row)
      : ([[row.text, null]] as Part[])
  // The text, scaled from the row's left edge, slid so the moving end sits under the caret.
  const x = inside.x - pad.x
  const caret = Math.max(4, Math.min(width - 4, at.x - left))
  return {
    parts,
    inlines: row.inlines ?? [],
    indent: at.sub ? row.wrapped.indent : 0,
    style: {
      transform: `translate(${Math.round(left)}px, ${Math.round(top)}px)`,
      height: `${height}px`,
      // Above the page, it takes the editor's font with it.
      ...(outside ? frameFont.value : null),
    },
    textStyle: {
      transform: `translateX(${caret - x * MAGNIFIER.scale}px) scale(${MAGNIFIER.scale})`,
    },
    caret,
  }
})

// ---------------------------------------------------------------- touch: keyboard

const keysList = computed(() => (Array.isArray(props.keys) ? props.keys : undefined))
const keysEditor = { run }
const { next: nextZIndex } = useZIndex()
const keysZIndex = ref<number>()
watch(showKeys, (shown) => {
  if (shown) keysZIndex.value = nextZIndex()
})
/**
 * The bar of keys sits in the page below the editor, and scrolls with it:
 * it never follows the keyboard, whose bars and panels each browser draws
 * its own way. A finger moves it anywhere by its grip, and it keeps that
 * place by the editor while the editor is in use.
 */
const KEYS_HEIGHT = 44
const KEYS_GAP = 8
const keysEl = ref<HTMLElement>()
/** Where the bar is, from the editor's top left corner; `null` until it first shows. */
const keysAt = ref<{ x: number; y: number } | null>(null)
/** Whether a finger or a key moved the bar: then it stays put, even as the keyboard comes up. */
let keysMoved = false
const keysShift = ref({ x: 0, y: 0 })
function readKeysShift() {
  const el = keysEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const at = keysClient.value
  if (!at) return
  // Moves the bar so that it lands where it is placed in the window, wherever its box starts.
  keysShift.value = {
    x: keysShift.value.x + at.x - rect.left,
    y: keysShift.value.y + at.y - rect.top,
  }
}

/** The editor's box in the window, as of the last scroll. */
function rootInPage() {
  void viewportTick.value
  return root.value?.getBoundingClientRect() ?? null
}

/** The bar's width: the editor's, within the window. */
const keysWidth = computed(() => {
  const rect = rootInPage()
  if (!rect) return 0
  return Math.max(0, Math.min(rect.width, visibleViewport().width - KEYS_GAP * 2))
})

/** Keeps the bar within the part of the page in view. */
function clampKeys(at: { x: number; y: number }) {
  const rect = rootInPage()
  if (!rect) return at
  const view = visibleViewport()
  const x = rect.left + at.x
  const y = rect.top + at.y
  const left = Math.max(
    view.left + KEYS_GAP,
    Math.min(x, view.left + view.width - keysWidth.value - KEYS_GAP),
  )
  const top = Math.max(
    view.top + KEYS_GAP,
    Math.min(y, view.top + view.height - KEYS_HEIGHT - KEYS_GAP),
  )
  return { x: left - rect.left, y: top - rect.top }
}

/** Below the editor, a gap apart, or as low as the page in view goes. */
function placeKeys() {
  const rect = rootInPage()
  if (!rect) return
  keysAt.value = clampKeys({ x: 0, y: rect.height + KEYS_GAP })
}

const keysClient = computed(() => {
  const rect = rootInPage()
  const at = keysAt.value
  return rect && at ? { x: rect.left + at.x, y: rect.top + at.y } : null
})

const keysStyle = computed(() => {
  const at = keysClient.value
  if (!at) return { visibility: 'hidden' as const, zIndex: keysZIndex.value }
  return {
    // Not rounded: the shift is read from the box as drawn, and rounding twice would be a pixel off.
    transform: `translate(${at.x + keysShift.value.x}px, ${at.y + keysShift.value.y}px)`,
    width: `${keysWidth.value}px`,
    zIndex: keysZIndex.value,
  }
})

watch(showKeys, (shown) => {
  if (!shown) keysFocused.value = false
  else if (typeof window !== 'undefined') settleKeys()
})

/**
 * Brings the bar into the page in view: not moved yet, to its place below
 * the editor; moved, only as far as it takes to be seen again.
 */
function settleKeys() {
  if (!showKeys.value) return
  if (keysMoved && keysAt.value) keysAt.value = clampKeys(keysAt.value)
  else placeKeys()
}

/** How much of the bottom of the page in view the bar takes, when it sits there. */
function keysRoom() {
  const rect = showKeys.value && keysAt.value ? root.value?.getBoundingClientRect() : null
  if (!rect || !keysAt.value) return 0
  const view = visibleViewport()
  const bottom = view.top + view.height
  const top = rect.top + keysAt.value.y
  return top + KEYS_HEIGHT >= bottom - KEYS_GAP - 1 ? bottom - top + KEYS_GAP : 0
}

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'

/** Tab out of the bar goes on to what follows the editor; Shift+Tab, or Escape, back into it. */
function onKeysKeydown(event: KeyboardEvent) {
  const bar = keysEl.value
  if (!bar) return
  if (event.key === 'Escape') {
    event.preventDefault()
    input.value?.focus()
    return
  }
  if (event.key !== 'Tab') return
  const inside = [...bar.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => el.tabIndex >= 0)
  const here = inside.indexOf(document.activeElement as HTMLElement)
  if (event.shiftKey && here <= 0) {
    event.preventDefault()
    input.value?.focus()
  } else if (!event.shiftKey && here === inside.length - 1) {
    event.preventDefault()
    const from = document.activeElement as HTMLElement | null
    for (const el of document.querySelectorAll<HTMLElement>(TABBABLE)) {
      if (
        el.tabIndex < 0 ||
        bar.contains(el) ||
        !root.value ||
        root.value.contains(el) ||
        !(root.value.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
      ) {
        continue
      }
      // Hidden ones take no focus: on to the next.
      el.focus()
      if (document.activeElement === el) return
    }
    from?.blur()
  }
}

function onKeysFocusOut(event: FocusEvent) {
  // On to another key of the bar, it stays.
  if (!keysEl.value?.contains(event.relatedTarget as Node | null)) keysFocused.value = false
}
// After drawing, from the box as drawn: wherever the page scrolled, the bar's own box starts.
watch([showKeys, viewportTick], () => readKeysShift(), { flush: 'post' })

/** A finger on the bar's grip: where it went down, and where the bar was then. */
let keysDrag: {
  pointer: number
  x: number
  y: number
  from: { x: number; y: number }
  hold: ReturnType<typeof holdPointer>
} | null = null

function onKeysGripDown(event: PointerEvent) {
  if (event.button !== 0 || !keysAt.value) return
  event.preventDefault()
  const hold = holdPointer(event, keysEl.value, endKeysDrag)
  hold.grab()
  keysDrag = {
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    from: keysAt.value,
    hold,
  }
  window.addEventListener('pointermove', onKeysGripMove)
  window.addEventListener('pointerup', endKeysDrag)
  window.addEventListener('pointercancel', endKeysDrag)
}

function onKeysGripMove(event: PointerEvent) {
  const press = keysDrag
  if (!press || event.pointerId !== press.pointer) return
  keysMoved = true
  keysAt.value = clampKeys({
    x: press.from.x + event.clientX - press.x,
    y: press.from.y + event.clientY - press.y,
  })
}

function endKeysDrag() {
  keysDrag?.hold.release()
  keysDrag = null
  window.removeEventListener('pointermove', onKeysGripMove)
  window.removeEventListener('pointerup', endKeysDrag)
  window.removeEventListener('pointercancel', endKeysDrag)
}

/** The grip moves by the arrow keys too, a step at a time. */
function onKeysGripKey(event: KeyboardEvent) {
  const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[
    event.key
  ]
  if (!step || !keysAt.value) return
  event.preventDefault()
  keysMoved = true
  const by = event.shiftKey ? 40 : 8
  keysAt.value = clampKeys({ x: keysAt.value.x + step[0]! * by, y: keysAt.value.y + step[1]! * by })
}

/**
 * Keeps the main cursor clear of the phone's keyboard:
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
  const view = visibleViewport()
  // The bar of keys at the bottom of the view covers what is behind it.
  const covered = keysRoom()
  const bottom = view.top + view.height - covered
  const visibleTop = Math.max(rect.top, view.top)
  const visibleBottom = Math.min(rect.bottom, bottom)
  if (at.bottom + room > visibleBottom && visibleBottom - visibleTop >= lh * 3) {
    el.scrollTop += (at.bottom + room - visibleBottom) / ratio.value
    onScroll()
  } else if (at.top - lh / 2 < visibleTop && visibleBottom - visibleTop >= lh * 3) {
    el.scrollTop -= (visibleTop - at.top + lh / 2) / ratio.value
    onScroll()
  }
  // Whatever the editor couldn't scroll, the page does.
  const after = coordsAtPos(mainRange(state.value.selection).head)
  if (!after || after.bottom + room <= bottom) return
  const before = window.scrollY
  window.scrollBy(0, after.bottom + room - bottom)
  // The bar at the bottom of the view stays there as the page goes up under it.
  if (covered && keysAt.value) {
    keysAt.value = { x: keysAt.value.x, y: keysAt.value.y + window.scrollY - before }
  }
}

/** How much of the window the keyboard took when last seen. */
let keyboardHeight = 0
function readKeyboard() {
  const vv = window.visualViewport
  // Zoomed in, the view is smaller by the zoom, not by a keyboard.
  return vv ? Math.max(0, window.innerHeight - vv.height * vv.scale) : 0
}

/**
 * Follows the keyboard as it comes up or grows (a row of candidates, another
 * layout), and only then: the view also resizes while the page scrolls, as
 * the browser's own bars shrink and grow, and scrolling the page back to the
 * cursor then would fight the finger.
 */
function onViewportChange() {
  const now = readKeyboard()
  const grew = now > keyboardHeight + 1
  keyboardHeight = now
  if (!grew || fingerScrolling) return
  // The bar first finds its place in view above the keyboard, so the cursor can keep clear of it.
  settleKeys()
  followViewport()
}

/**
 * A finger scrolls the page, by dragging or by the glide after it: the view
 * resizing meanwhile is the browser's bars, never a reason to scroll back.
 * The browser scrolling to the cursor on its own, as a tap brings the
 * keyboard up, has no finger moving and leaves the editor free to follow.
 */
let fingerScrolling = false
let pageScrollTimer = 0
function settleLater() {
  clearTimeout(pageScrollTimer)
  pageScrollTimer = window.setTimeout(() => (fingerScrolling = false), 160)
}
function onPageScroll() {
  if (fingerScrolling) settleLater()
}
function onFingerMove() {
  fingerScrolling = true
  settleLater()
}

/** On a touch screen the keyboard comes and goes with focus; the view follows it meanwhile. */
const following = computed(() => coarse.value && focused.value)
function unfollow() {
  if (typeof window === 'undefined') return
  const vv = window.visualViewport
  vv?.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onPageScroll)
  window.removeEventListener('touchmove', onFingerMove)
  clearTimeout(pageScrollTimer)
  fingerScrolling = false
}
watch(following, (on) => {
  const vv = window.visualViewport
  if (on) {
    keyboardHeight = readKeyboard()
    vv?.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onPageScroll, { passive: true })
    window.addEventListener('touchmove', onFingerMove, { passive: true })
  } else unfollow()
})

// ---------------------------------------------------------------- minimap

/** Height of a row in the minimap, and width of a character, in px. */
const MINI_ROW = 2
const MINI_CELL = 1
/** The minimap's width, padding included. */
const MINI_WIDTH = 96
const MINI_PAD = 6
const minimapCanvas = ref<HTMLCanvasElement>()
/** The editor's own width, minimap included. */
const rootWidth = ref(0)
const minimapOn = computed(() => !!props.minimap && mounted.value && rootWidth.value >= 480)

/** Where the minimap is: the row at its top (fractional), and the part in view as a box. */
const minimap = computed(() => {
  if (!minimapOn.value) return null
  const track = viewHeight.value
  const lh = lineHeight.value || 1
  const height = layout.value.total * MINI_ROW
  const textTop = scrollTop.value * ratio.value
  const first = rowAtTextY(Math.max(0, textTop - pad.y))
  const last = rowAtTextY(Math.max(0, textTop + track - pad.y))
  const range = Math.max(1, total.value + pad.y * 2 - track)
  const progress = Math.min(1, Math.max(0, textTop / range))
  const top = height > track ? progress * (height - track) : 0
  const firstFraction = first + ((textTop - pad.y - rowTop(first)) / lh || 0)
  return {
    top,
    track,
    height,
    slider: {
      top: Math.max(0, firstFraction) * MINI_ROW - top,
      height: Math.max(MINI_ROW * 4, (last - first + 1) * MINI_ROW),
    },
  }
})

/** Whether a character is drawn two cells wide: CJK, Hangul, full-width forms. */
const isWideCode = (code: number) =>
  (code >= 0x1100 && code <= 0x115f) ||
  (code >= 0x2e80 && code <= 0xa4cf) ||
  (code >= 0xac00 && code <= 0xd7a3) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0xfe30 && code <= 0xfe4f) ||
  (code >= 0xff00 && code <= 0xff60) ||
  (code >= 0xffe0 && code <= 0xffe6)

/** The token colors, read from the theme when it changes. */
let miniColors: { key: string; text: string; types: string[] } | null = null
function minimapColors(canvas: HTMLCanvasElement) {
  const style = getComputedStyle(canvas)
  const key = `${style.color}|${style.getPropertyValue('--dou-color-syntax-keyword')}`
  if (miniColors?.key === key) return miniColors
  const swatch = document.createElement('span')
  swatch.style.display = 'none'
  canvas.parentElement!.append(swatch)
  const types = tokenTypes.map((type) => {
    swatch.style.color = `var(--dou-color-syntax-${type}, currentColor)`
    return getComputedStyle(swatch).color
  })
  swatch.remove()
  miniColors = { key, text: style.color, types }
  return miniColors
}

let miniFrame = 0
function drawMinimap() {
  miniFrame = 0
  const canvas = minimapCanvas.value
  const map = minimap.value
  if (!canvas || !map) return
  const dpr = window.devicePixelRatio || 1
  const width = MINI_WIDTH
  const height = map.track
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const colors = minimapColors(canvas)
  const text = doc.value
  const lay = layout.value
  const hl = highlighter
  const cols = Math.floor((width - MINI_PAD * 2) / MINI_CELL)
  const tab = props.tabSize
  const firstRow = Math.max(0, Math.floor(map.top / MINI_ROW))
  const lastRow = Math.min(lay.total - 1, Math.ceil((map.top + height) / MINI_ROW))
  const mark = MINI_ROW * 0.75
  ctx.globalAlpha = 0.7
  let row = firstRow
  while (row <= lastRow) {
    const { n, sub } = lay.lineAtRow(row)
    const rowText = text.lineText(n)
    const breaks = wrapRows ? wrapOf(rowText).breaks : []
    const tokens = hl && (hl.ready(n) || n - hl.frontier <= SYNTAX_REACH) ? hl.line(n) : null
    const rowsHere = lay.rowsOf(n)
    for (let k = sub; k < rowsHere && row <= lastRow; k++, row++) {
      const start = k ? breaks[k - 1]! : 0
      const end = k < breaks.length ? breaks[k]! : rowText.length
      const y = row * MINI_ROW - map.top
      let col = 0
      let runFrom = -1
      let runColor = ''
      let t = 0
      const flush = () => {
        if (runFrom < 0) return
        ctx.fillStyle = runColor
        ctx.fillRect(MINI_PAD + runFrom * MINI_CELL, y, (col - runFrom) * MINI_CELL, mark)
        runFrom = -1
      }
      for (let i = start; i < end && col < cols; i++) {
        const code = rowText.charCodeAt(i)
        if (code === 32 || code === 9) {
          flush()
          col += code === 9 ? tab - (col % tab) : 1
          continue
        }
        let color = colors.text
        if (tokens) {
          while (t < tokens.length && tokens[t]! <= i) t += 2
          const type = t < tokens.length ? tokens[t + 1]! : -1
          if (type >= 0) color = colors.types[type]!
        }
        if (runFrom >= 0 && color !== runColor) flush()
        if (runFrom < 0) {
          runFrom = col
          runColor = color
        }
        // CJK and other wide characters take two cells, as they do in the text
        col += code >= 0x1100 && isWideCode(code) ? 2 : 1
      }
      flush()
    }
  }
}
function scheduleMinimap() {
  if (!miniFrame && minimapOn.value) miniFrame = requestAnimationFrame(drawMinimap)
}
watch([minimap, doc, layout, syntaxTick, () => props.tabSize], () => scheduleMinimap(), {
  flush: 'post',
})
// The colors come from the theme: switching it (a class on the page, or the system's) draws again.
let themeWatch: (() => void) | null = null
watch(minimapOn, (on) => {
  themeWatch?.()
  themeWatch = null
  if (!on || typeof MutationObserver === 'undefined') return
  const observer = new MutationObserver(scheduleMinimap)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-dou-theme'],
  })
  const dark = matchMedia?.('(prefers-color-scheme: dark)')
  dark?.addEventListener?.('change', scheduleMinimap)
  themeWatch = () => {
    observer.disconnect()
    dark?.removeEventListener?.('change', scheduleMinimap)
  }
})
onBeforeUnmount(() => {
  if (miniFrame) cancelAnimationFrame(miniFrame)
  themeWatch?.()
})

/** Scrolls so that minimap row `row` is in the middle of the view. */
function scrollToMiniRow(row: number) {
  const el = scroller.value
  if (!el) return
  const lay = layout.value
  const at = Math.max(0, Math.min(lay.total - 1, Math.floor(row)))
  const y = pad.y + rowTop(at) - el.clientHeight / 2
  el.scrollTop = Math.max(0, y / ratio.value)
  onScroll()
}

let miniDrag: { y: number; scroll: number; pointer: number } | null = null
function onMinimapDown(event: PointerEvent) {
  const map = minimap.value
  const canvas = event.currentTarget as HTMLElement
  if (!map || event.button !== 0) return
  event.preventDefault()
  const box = canvas.getBoundingClientRect()
  const y = event.clientY - box.top
  // A press beside the mark goes there first; dragging then moves the mark.
  if (y < map.slider.top || y > map.slider.top + map.slider.height)
    scrollToMiniRow((map.top + y) / MINI_ROW)
  miniDrag = { y: event.clientY, scroll: scroller.value?.scrollTop ?? 0, pointer: event.pointerId }
  canvas.setPointerCapture?.(event.pointerId)
}
function onMinimapMove(event: PointerEvent) {
  const map = minimap.value
  const el = scroller.value
  if (!miniDrag || !map || !el || event.pointerId !== miniDrag.pointer) return
  const dy = event.clientY - miniDrag.y
  const max = el.scrollHeight - el.clientHeight
  // The mark follows the pointer: over a short text it moves with the rows, over a long one along the track.
  const room =
    map.height > map.track ? map.track - map.slider.height : map.height - map.slider.height
  el.scrollTop = Math.max(0, Math.min(max, miniDrag.scroll + (dy * max) / Math.max(1, room)))
  onScroll()
}
function onMinimapUp(event: PointerEvent) {
  if (miniDrag?.pointer === event.pointerId) miniDrag = null
}

// ---------------------------------------------------------------- scrolling

function onScroll() {
  const el = scroller.value
  if (!el) return
  // iOS reports positions past either end while the content bounces back
  const { top, left } = scrollPositionOf(el)
  scrollTop.value = top
  scrollLeft.value = left
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
  const x = pad.x + at.x
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
  pad.y = measure.padY
  pad.x = measure.padX
  readFrameFont()
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
  rootWidth.value = root.value?.clientWidth ?? 0
  if (typeof ResizeObserver !== 'undefined') {
    resize = new ResizeObserver(() => {
      viewHeight.value = el.clientHeight
      viewWidth.value = el.clientWidth
      rootWidth.value = root.value?.clientWidth ?? 0
      updateClip()
    })
    resize.observe(el)
    if (root.value) resize.observe(root.value)
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
let restarts: number[] = []
let restartWarned = false
/** An extension made in the template is new on every render, and set up again each time. */
function warnRestarts() {
  if (process.env.NODE_ENV === 'production' || restartWarned) return
  const now = Date.now()
  restarts = [...restarts.filter((time) => now - time < 1000), now]
  if (restarts.length < 4) return
  restartWarned = true
  console.warn(
    '[@dou-ui/code] the extensions keep being set up again, which also starts their state over (such as a shared undo history). Create them once in <script setup> instead of in the template.',
  )
}
watch(extensions, (next) => {
  if (!mounted.value) return
  let restarted = false
  for (const [extension, cleanup] of cleanups)
    if (!next.includes(extension)) {
      cleanup()
      cleanups.delete(extension)
      restarted = true
    }
  for (const extension of next) startExtension(extension)
  if (restarted) warnRestarts()
})

onBeforeUnmount(() => {
  if (syntaxJob) cancelIdle(syntaxJob)
  clearTimeout(searchTimer)
  resize?.disconnect()
  widgetObserver?.disconnect()
  inlineObserver?.disconnect()
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
  // A press or drag never outlives the focus: the page must scroll again once the keyboard is away.
  onPointerCancel()
  endHandlePress()
  endDrag()
  focused.value = false
  menuOpen.value = false
  // A finger's box goes with the keyboard; a mouse's stays while the mouse is over it.
  if (problemBox.value?.keyboard || touchUi.value) closeProblems()
  closeCompletion()
  closeSignature()
  closeHistory()
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
    if (historyHandler.value) return historyHandler.value.canUndo()
    void historyTick.value
    return history.canUndo
  },
  get canRedo() {
    if (historyHandler.value) return historyHandler.value.canRedo()
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
  get focused() {
    return focused.value
  },
  get messages() {
    return messages.value
  },
  announce,
  relint: (name) => {
    if (mounted.value) runLint(name)
  },
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
      ns.is('bordered', bordered),
    ]"
    :style="{
      '--dou-code-editor-gutter': `${gutterWidth}px`,
      '--dou-code-editor-gutter-cells': `${gutterCells}px`,
      '--dou-code-editor-tab-size': tabSize,
    }"
  >
    <div v-if="searchOpen" :class="ns.e('search')">
      <DouFindReplace
        ref="panel"
        :search="query.search"
        :replace="query.replace ?? ''"
        v-model:replacing="showReplace"
        :count="matches.length"
        :current="currentMatch"
        :capped="capped"
        :error="searchError && common('findReplace.invalidRegexp')"
        :readonly="readonly || disabled"
        @update:search="query = { ...query, search: $event }"
        @update:replace="query = { ...query, replace: $event }"
        @next="nextMatch()"
        @previous="previousMatch()"
        @replace-one="replaceOne"
        @replace-all="replaceAll"
        @close="closeSearch"
      >
        <template #options>
          <DouTooltip
            v-for="option in searchOptions"
            :key="option.key"
            :content="common(`findReplace.${option.key}`)"
          >
            <DouToggle
              :pressed="!!query[option.key]"
              size="sm"
              :aria-label="common(`findReplace.${option.key}`)"
              @update:pressed="query = { ...query, [option.key]: $event }"
            >
              <component :is="option.icon" />
            </DouToggle>
          </DouTooltip>
        </template>
      </DouFindReplace>
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
    <div :class="ns.e('body')">
      <div ref="scroller" :class="ns.e('scroller')" @scroll.passive="onScroll">
        <div
          :class="ns.e('sizer')"
          :style="{
            height: `${sizerHeight}px`,
            minWidth: `max(100%, ${contentWidth + gutterWidth}px)`,
          }"
        >
          <div
            v-if="gutter && (lineNumbers || foldable || gutterCells)"
            :class="ns.e('gutter')"
            @pointerdown="onPointerDown($event, 'gutter')"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp($event, 'gutter')"
            @pointercancel="onPointerCancel"
            @pointerenter="gutterHover = true"
            @pointerleave="gutterHover = false"
            @mousedown.prevent
          >
            <div
              :class="ns.e('numbers')"
              :style="{ transform: `translateY(${yOf(visibleFrom)}px)` }"
            >
              <div
                v-for="row in rows"
                :key="row.n"
                :class="[
                  ns.e('number'),
                  ns.is('active', row.n === activeLineNumber),
                  ns.is('hovered', row.n === hoveredLine),
                ]"
                :style="{
                  height: row.wrapped.breaks.length
                    ? `${(row.wrapped.breaks.length + 1) * lineHeight}px`
                    : undefined,
                  marginTop: gapBefore(row.n) ? `${gapBefore(row.n)}px` : undefined,
                }"
              >
                <span v-if="gutterCells" :class="ns.e('cells')">
                  <span
                    v-for="(column, c) in gutterColumns"
                    :key="column.name"
                    :class="[
                      ns.e('cell'),
                      ns.is('on-hover', gutterMarkers[c]?.get(row.n)?.visible === 'hover'),
                      gutterMarkers[c]?.get(row.n)?.class,
                    ]"
                    :style="{ width: `${column.width}px` }"
                    :title="gutterMarkers[c]?.get(row.n)?.title"
                    :data-gutter-cell="column.onPress ? c : undefined"
                    :data-line="row.n"
                    v-bind="
                      column.onPress && gutterMarkers[c]?.get(row.n) && !disabled
                        ? {
                            role: 'button',
                            // one stop in the tab order: the marker on the cursor's line
                            tabindex: row.n === activeLineNumber ? 0 : -1,
                            'aria-label': gutterMarkers[c]!.get(row.n)!.title,
                          }
                        : { 'aria-hidden': 'true' }
                    "
                    @keydown="onCellKeydown($event, c, row.n)"
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
                <span v-if="lineNumbers" aria-hidden="true">{{ row.n }}</span>
                <span
                  v-if="foldable && (row.folded || foldableLines.has(row.n))"
                  :class="[ns.e('fold-toggle'), ns.is('folded', row.folded)]"
                  :data-fold="row.n"
                  aria-hidden="true"
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
                  row.inlinesKey,
                  row.lineClass,
                  gapBefore(row.n),
                ]"
                :class="[
                  ns.e('line'),
                  ns.is('wrapped', !!row.wrapped.breaks.length),
                  row.lineClass,
                ]"
                :style="gapBefore(row.n) ? { marginTop: `${gapBefore(row.n)}px` } : undefined"
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
                      ><span
                        v-if="part[3] !== undefined"
                        :ref="
                          (el) =>
                            observeInline(
                              el as Element | null,
                              row.inlines![part[3]!]!.key,
                              row.inlines![part[3]!]!.width,
                            )
                        "
                        :class="ns.e('inline')"
                        :style="
                          row.inlines![part[3]!]!.width !== undefined
                            ? { width: `${row.inlines![part[3]!]!.width}px` }
                            : undefined
                        "
                        ><RenderPart :render="row.inlines![part[3]!]!.render" /></span
                      ><span
                        v-else-if="part[1]"
                        :class="part[1]"
                        :title="part[2]"
                        :style="part[4]"
                        >{{ part[0] }}</span
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
                <template v-else-if="row.tokens || row.marks || row.inlines"
                  ><template v-for="(part, i) in partsOf(row)" :key="i"
                    ><span
                      v-if="part[3] !== undefined"
                      :ref="
                        (el) =>
                          observeInline(
                            el as Element | null,
                            row.inlines![part[3]!]!.key,
                            row.inlines![part[3]!]!.width,
                          )
                      "
                      :class="ns.e('inline')"
                      :style="
                        row.inlines![part[3]!]!.width !== undefined
                          ? { width: `${row.inlines![part[3]!]!.width}px` }
                          : undefined
                      "
                      ><RenderPart :render="row.inlines![part[3]!]!.render" /></span
                    ><span v-else-if="part[1]" :class="part[1]" :title="part[2]" :style="part[4]">{{
                      part[0]
                    }}</span
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
            <!-- The boxes about the text and the touch handles: above the page, or inside the frame. -->
            <Teleport :to="floatingTarget || 'body'" :disabled="!floatingTarget">
              <div
                ref="floatingEl"
                :class="[
                  ns.e('floating'),
                  ns.is('outside', !!floatingTarget),
                  ns.is('fixed', !!floatingTarget && anchorMode === 'fixed'),
                  ns.is('scrolling', !!floatingTarget && boxScrolling),
                ]"
                :style="
                  floatingTarget
                    ? {
                        ...frameVars,
                        zIndex: floatingZ,
                        transform: `translate(${layerShift.x}px, ${layerShift.y}px)`,
                      }
                    : undefined
                "
              >
                <div
                  v-if="problemStyle"
                  ref="problemEl"
                  :class="ns.e('problems')"
                  role="group"
                  :aria-label="problemBox!.problems.length ? messages.problems : messages.details"
                  :style="problemStyle"
                  @pointerdown.stop.prevent
                  @pointermove.stop
                  @pointerenter="keepProblems"
                  @pointerleave="onContentLeave"
                >
                  <div
                    v-for="(item, i) in problemBox!.info"
                    :key="`info-${i}`"
                    :class="ns.e('hover')"
                  >
                    <template v-if="typeof item === 'string'">{{ item }}</template>
                    <RenderPart v-else :render="item" />
                  </div>
                  <div
                    v-for="(problem, i) in problemBox!.problems"
                    :key="i"
                    :class="[ns.e('problem-item'), ns.is(problem.severity, true)]"
                  >
                    <component
                      :is="SEVERITY_ICON[problem.severity]"
                      :class="ns.e('problem-severity')"
                    />
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
                      :aria-current="i === problemBox!.index || undefined"
                      @click="runFix(i)"
                    >
                      {{ fix.action.label }}
                    </button>
                  </div>
                </div>
                <div
                  v-if="completionStyle"
                  ref="completionEl"
                  :class="ns.e('completions')"
                  :style="completionStyle"
                  @pointerdown.stop.prevent
                  @pointermove.stop
                >
                  <div
                    :id="completionId"
                    ref="completionList"
                    :class="ns.e('completion-list')"
                    role="listbox"
                    :aria-label="messages.completions"
                  >
                    <div
                      v-for="(item, i) in completion!.items"
                      :id="`${completionId}-${i}`"
                      :key="i"
                      role="option"
                      :aria-selected="i === completion!.index"
                      :class="[ns.e('completion'), ns.is('active', i === completion!.index)]"
                      @click="acceptCompletion(i)"
                    >
                      <component
                        :is="KIND_ICON[item.option.kind ?? 'text']"
                        :class="[ns.e('completion-kind'), ns.is(item.option.kind ?? 'text', true)]"
                        aria-hidden="true"
                      />
                      <span :class="ns.e('completion-label')"
                        ><template v-for="(part, j) in labelParts(item)" :key="j"
                          ><mark v-if="part[1]" :class="ns.e('completion-match')">{{
                            part[0]
                          }}</mark
                          ><template v-else>{{ part[0] }}</template></template
                        ></span
                      >
                      <span v-if="item.option.detail" :class="ns.e('completion-detail')">{{
                        item.option.detail
                      }}</span>
                    </div>
                  </div>
                  <div
                    v-if="completion!.items[completion!.index]?.option.info"
                    :class="ns.e('completion-info')"
                  >
                    <template
                      v-if="typeof completion!.items[completion!.index]!.option.info === 'string'"
                      >{{ completion!.items[completion!.index]!.option.info }}</template
                    >
                    <RenderPart
                      v-else
                      :render="
                        completion!.items[completion!.index]!.option.info as () => VNodeChild
                      "
                    />
                  </div>
                </div>
                <div
                  v-if="signatureStyle"
                  ref="signatureEl"
                  :class="ns.e('signature')"
                  role="note"
                  :aria-label="messages.signature"
                  :style="signatureStyle"
                  @pointerdown.stop.prevent
                >
                  <div :class="ns.e('signature-label')">
                    <template v-for="(part, i) in signatureParts" :key="i"
                      ><span v-if="part[1]" :class="ns.e('signature-active')">{{ part[0] }}</span
                      ><template v-else>{{ part[0] }}</template></template
                    >
                  </div>
                  <div v-if="signature!.result.info" :class="ns.e('signature-info')">
                    <template v-if="typeof signature!.result.info === 'string'">{{
                      signature!.result.info
                    }}</template>
                    <RenderPart v-else :render="signature!.result.info" />
                  </div>
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
                      ><span
                        v-if="part[3] !== undefined"
                        :class="ns.e('inline')"
                        :style="{ width: `${widthOf(magnifier.inlines[part[3]!]!)}px` }"
                        ><RenderPart :render="magnifier.inlines[part[3]!]!.render" /></span
                      ><span
                        v-else-if="part[1]"
                        :class="part[1]"
                        :title="part[2]"
                        :style="part[4]"
                        >{{ part[0] }}</span
                      ><template v-else>{{ part[0] }}</template></template
                    >
                  </div>
                  <div
                    :class="ns.e('magnifier-caret')"
                    :style="{ left: `${magnifier.caret - 1}px` }"
                  />
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
              </div>
            </Teleport>
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
              :aria-autocomplete="hasCompletion ? 'list' : undefined"
              :aria-controls="completion ? completionId : undefined"
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
            <!-- After the textarea, so Escape then Tab reaches what is inside the widgets. -->
            <div
              v-if="shownWidgets.length"
              :class="ns.e('widgets')"
              @pointerdown.stop
              @pointermove.stop
              @mousedown.stop
            >
              <div
                v-for="widget in shownWidgets"
                :key="widget.key"
                :ref="(el) => observeWidget(el as Element | null, widget.key)"
                :class="ns.e('widget')"
                :role="widget.label ? 'group' : undefined"
                :aria-label="widget.label"
                :style="{
                  transform: `translate(${scrollLeft}px, ${widget.top}px)`,
                  width: `${Math.max(0, viewWidth - gutterWidth)}px`,
                }"
              >
                <RenderPart :render="widget.render" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="minimapOn && minimap"
        :class="ns.e('minimap')"
        aria-hidden="true"
        @pointerdown="onMinimapDown"
        @pointermove="onMinimapMove"
        @pointerup="onMinimapUp"
        @pointercancel="onMinimapUp"
      >
        <canvas ref="minimapCanvas" :class="ns.e('minimap-canvas')" />
        <div
          :class="ns.e('minimap-view')"
          :style="{
            transform: `translateY(${minimap.slider.top}px)`,
            height: `${minimap.slider.height}px`,
          }"
        />
      </div>
    </div>
    <div v-if="panels.bottom.length" :class="[ns.e('panels'), ns.is('bottom', true)]">
      <RenderPart v-for="panel in panels.bottom" :key="panel.key" :render="panel.render" />
    </div>
    <Teleport to="body">
      <div
        v-if="showKeys"
        ref="keysEl"
        :class="[
          ns.e('keys'),
          ns.is('fixed', anchorMode === 'fixed'),
          ns.is('scrolling', boxScrolling),
        ]"
        :style="keysStyle"
        @focusin="keysFocused = true"
        @focusout="onKeysFocusOut"
        @keydown="onKeysKeydown"
      >
        <button
          type="button"
          :class="ns.e('keys-grip')"
          :aria-label="messages.moveKeys"
          :title="messages.moveKeys"
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          @pointerdown="onKeysGripDown"
          @keydown="onKeysGripKey"
          @mousedown.prevent
        >
          <GripVerticalIcon />
        </button>
        <CodeKeys :editor="keysEditor" :keys="keysList" :messages="messages" />
      </div>
    </Teleport>
  </div>
</template>
