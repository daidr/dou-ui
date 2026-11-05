<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DiffSplitIcon,
  DiffUnifiedIcon,
  FoldVerticalIcon,
  UnfoldVerticalIcon,
} from '@dou-ui/icons'
import { DouButton, DouTooltip, createScrollLink, useNamespace } from 'dou-ui'
import {
  type VNodeChild,
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
} from 'vue'
import CodeEditor from './code-editor.vue'
import RenderPart from './render-part'
import { type CodeDiffHunk, diffText, lineStarts } from './core/diff'
import type { CodeKeymap } from './core/keymap'
import type { CodeTransactionResult } from './core/transaction'
import { splitLines } from './core/text'
import {
  type CodeDecoration,
  type CodeExtension,
  type CodeGutterHoverMarker,
  type CodeGutterMarker,
  type CodeWidget,
  defineCodeExtension,
  WIDGET_HEIGHT_KEY,
} from './extension'
import { format, useCodeMessages } from './locale'
import type {
  CodeDiffEmits,
  CodeDiffGutter,
  CodeDiffHoverMarker,
  CodeDiffProps,
  CodeDiffSide,
  CodeDiffWidget,
  CodeEditorExpose,
} from './types'

/**
 * Two texts compared: side by side, or the changes in one column. Changed
 * lines are tinted, the words that changed inside them marked, and long
 * runs of unchanged lines hidden behind a bar that shows them.
 */
defineOptions({ name: 'DouCodeDiff' })

const props = withDefaults(defineProps<CodeDiffProps>(), {
  original: '',
  modelValue: '',
  language: undefined,
  mode: 'auto',
  editable: false,
  collapseUnchanged: true,
  ignoreWhitespace: false,
  words: true,
  wrap: false,
  extensions: undefined,
  gutters: undefined,
  widgets: undefined,
  tabSize: 2,
  toolbar: true,
  bordered: true,
  messages: undefined,
})
const emit = defineEmits<CodeDiffEmits>()

const ns = useNamespace('code-diff')
const messages = useCodeMessages(() => props.messages)

// ---------------------------------------------------------------- view

const root = ref<HTMLElement>()
/** Whether the box is wide enough for two columns. */
const roomy = ref(true)
/** The view picked with the toggle, when `mode` isn't bound. */
const picked = ref<'split' | 'inline' | null>(null)
watch(
  () => props.mode,
  () => (picked.value = null),
)
const view = computed<'split' | 'inline'>(() => {
  if (picked.value) return picked.value
  if (props.mode !== 'auto') return props.mode
  return roomy.value ? 'split' : 'inline'
})
function toggleView() {
  const other = view.value === 'split' ? 'inline' : 'split'
  picked.value = other
  emit('update:mode', other)
}

/** Below this, each side would show fewer than about 30 columns: one column reads better. */
const SPLIT_WIDTH = 560

let resize: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !root.value) return
  resize = new ResizeObserver(([entry]) => {
    if (entry) roomy.value = entry.contentRect.width >= SPLIT_WIDTH
  })
  resize.observe(root.value)
})
onBeforeUnmount(() => resize?.disconnect())

// ---------------------------------------------------------------- texts and changes

/** The modified text as edited here, ahead of the parent's copy. */
const modified = ref(props.modelValue)
watch(
  () => props.modelValue,
  (value) => (modified.value = value),
)
function onModifiedInput(value: string) {
  modified.value = value
  emit('update:modelValue', value)
}

const hunks = computed<CodeDiffHunk[]>(() =>
  diffText(props.original, modified.value, {
    ignoreWhitespace: props.ignoreWhitespace,
    words: props.words,
  }),
)
const originalLines = computed(() => splitLines(props.original))
const modifiedLines = computed(() => splitLines(modified.value))

const stats = computed(() => {
  let added = 0
  let removed = 0
  for (const hunk of hunks.value) {
    added += hunk.modifiedCount
    removed += hunk.originalCount
  }
  return { added, removed }
})

// ---------------------------------------------------------------- unchanged lines

interface Unchanged {
  /** First line on each side, from 1. */
  a: number
  b: number
  count: number
  /** Where its hidden part starts, from its first line, and how long it is (0 when nothing is hidden). */
  hideFrom: number
  hideCount: number
  /** Stays the same while the modified text is edited. */
  key: number
}

const collapse = computed(() => {
  const option = props.collapseUnchanged
  if (!option) return null
  const own = option === true ? {} : option
  return {
    context: Math.max(1, Math.floor(own.context ?? 3)),
    minLines: Math.max(1, Math.floor(own.minLines ?? 4)),
  }
})
/** The runs of unchanged lines opened with their bar, by key; `true` for all of them. */
const opened = reactive(new Set<number>())
const allOpen = ref(false)

/**
 * The lines with a marker or widget on each side, which collapsing leaves in
 * view. A marker shown only on hover is out of sight, so it doesn't count.
 */
const annotatedLines = computed(() => {
  const out = { a: new Set<number>(), b: new Set<number>() }
  const add = (side: CodeDiffSide, line: number) => out[side === 'original' ? 'a' : 'b'].add(line)
  for (const gutter of props.gutters ?? [])
    for (const marker of gutter.markers ?? [])
      if (marker.visible !== 'hover') add(marker.side, marker.line)
  for (const widget of props.widgets ?? []) add(widget.side, widget.line)
  return out
})

const unchanged = computed<Unchanged[]>(() => {
  const list = hunks.value
  const total = originalLines.value.length
  const out: Unchanged[] = []
  const rule = collapse.value
  const push = (a: number, b: number, count: number, before: boolean, after: boolean) => {
    if (count <= 0) return
    let hideFrom = 0
    let hideCount = 0
    if (rule && list.length && !allOpen.value && !opened.has(a)) {
      const from = before ? rule.context : 0
      const to = count - (after ? rule.context : 0)
      if (to - from >= rule.minLines) {
        hideFrom = from
        hideCount = to - from
      }
    }
    out.push({ a, b, count, hideFrom, hideCount, key: a })
  }
  // A line with a marker or widget stays in view, with context around it, like a change.
  const kept = annotatedLines.value
  const cut = (a: number, b: number, count: number, before: boolean, after: boolean) => {
    let from = 0
    for (let i = 0; i < count; i++) {
      if (!kept.a.has(a + i) && !kept.b.has(b + i)) continue
      if (i > from) push(a + from, b + from, i - from, from > 0 || before, true)
      from = Math.max(from, i)
    }
    push(a + from, b + from, count - from, from > 0 || before, after)
  }
  let a = 1
  let b = 1
  for (let i = 0; i < list.length; i++) {
    const hunk = list[i]!
    cut(a, b, hunk.originalStart - a, i > 0, true)
    a = hunk.originalStart + hunk.originalCount
    b = hunk.modifiedStart + hunk.modifiedCount
  }
  cut(a, b, total - a + 1, list.length > 0, false)
  return out
})
const hiddenCount = computed(() => unchanged.value.reduce((sum, run) => sum + run.hideCount, 0))
const anyHideable = computed(() => !!collapse.value && hunks.value.length > 0)

function open(key: number) {
  opened.add(key)
}
function toggleAll() {
  if (hiddenCount.value) allOpen.value = true
  else {
    allOpen.value = false
    opened.clear()
  }
}
// A new pair of texts starts collapsed again.
watch(
  () => props.original,
  () => {
    allOpen.value = false
    opened.clear()
  },
)

/**
 * The bar over a run of hidden lines. Side by side, the original's bar
 * mirrors the modified one's: pressed with a pointer, but left out of the
 * keyboard order and of what is read out, so the run is one stop, not two.
 */
function bar(run: Unchanged, mirror = false) {
  const label = format(messages.value.diffUnchanged, { count: run.hideCount })
  return h(
    'button',
    {
      type: 'button',
      class: ns.e('bar'),
      'aria-label': `${messages.value.unfold}：${label}`,
      'aria-hidden': mirror ? 'true' : undefined,
      tabindex: mirror ? -1 : undefined,
      onClick: () => open(run.key),
    },
    [h(UnfoldVerticalIcon, { class: ns.e('bar-icon') }), h('span', label)],
  )
}
const BAR_HEIGHT = 28

// ---------------------------------------------------------------- side by side

type Side = 'a' | 'b'

/** What one side of the split view draws: tints, marks, fillers, hidden lines and bars. */
function sideExtension(side: Side): CodeExtension {
  const startOf = (hunk: CodeDiffHunk) => (side === 'a' ? hunk.originalStart : hunk.modifiedStart)
  const countOf = (hunk: CodeDiffHunk) => (side === 'a' ? hunk.originalCount : hunk.modifiedCount)
  const otherCountOf = (hunk: CodeDiffHunk) =>
    side === 'a' ? hunk.modifiedCount : hunk.originalCount
  const tone = side === 'a' ? 'removed' : 'added'

  return defineCodeExtension({
    name: 'diff',
    decorations({ visible }) {
      const out: CodeDecoration[] = []
      for (const hunk of hunks.value) {
        const start = startOf(hunk)
        const count = countOf(hunk)
        if (start > visible.to) break
        if (!count || start + count - 1 < visible.from) continue
        const from = Math.max(start, visible.from)
        const to = Math.min(start + count - 1, visible.to)
        for (let n = from; n <= to; n++)
          out.push({ type: 'line', line: n, class: `${ns.e('line')} is-${tone}` })
        for (const part of hunk.parts) {
          const range = side === 'a' ? part.original : part.modified
          if (range.to > range.from)
            out.push({
              type: 'mark',
              from: range.from,
              to: range.to,
              class: `${ns.e('word')} is-${tone}`,
            })
        }
      }
      return out
    },
    gutters: [
      {
        name: 'diff',
        width: 16,
        markers({ visible }) {
          const out: CodeGutterMarker[] = []
          const title = side === 'a' ? messages.value.diffRemoved : messages.value.diffAdded
          for (const hunk of hunks.value) {
            const start = startOf(hunk)
            const count = countOf(hunk)
            if (start > visible.to) break
            for (let n = Math.max(start, visible.from); n < start + count && n <= visible.to; n++)
              out.push({
                line: n,
                text: side === 'a' ? '−' : '+',
                class: `${ns.e('sign')} is-${tone}`,
                title,
              })
          }
          return out
        },
      },
    ],
    widgets() {
      const out: CodeWidget[] = []
      const fills = splitPlan.value[side].fills
      hunks.value.forEach((hunk, i) => {
        const missing = otherCountOf(hunk) - countOf(hunk)
        if (missing <= 0) return
        const last = startOf(hunk) - 1 + countOf(hunk)
        const blanks = fills.get(i) ?? []
        out.push({
          // the height in the id: the editor never keeps a size measured before blanks changed
          id: `fill-${i}-${missing}-${blanks.map((blank) => blank.height).join('.')}`,
          ...(last >= 1 ? { line: last } : { line: 1, position: 'above' as const }),
          height: missing * LINE + blanks.reduce((sum, blank) => sum + blank.height, 0),
          render: () => filler(missing, blanks),
        })
      })
      const total = side === 'a' ? originalLines.value.length : modifiedLines.value.length
      for (const run of unchanged.value) {
        if (!run.hideCount) continue
        const first = (side === 'a' ? run.a : run.b) + run.hideFrom
        const last = first + run.hideCount - 1
        out.push({
          id: `bar-${run.key}`,
          ...(last < total ? { line: last + 1, position: 'above' as const } : { line: first - 1 }),
          height: BAR_HEIGHT,
          render: () => bar(run, side === 'a'),
        })
      }
      return out
    },
    hide() {
      const out: Array<{ from: number; to: number }> = []
      for (const run of unchanged.value) {
        if (!run.hideCount) continue
        const first = (side === 'a' ? run.a : run.b) + run.hideFrom
        out.push({ from: first, to: first + run.hideCount - 1 })
      }
      return out
    },
  })
}

/** Rows of filler, or rows split by the blanks of widgets on the other side. */
const block = (count: number) =>
  h('div', {
    class: ns.e('filler'),
    style: { height: `calc(${count} * var(--dou-code-editor-line-height))` },
  })
function filler(rows: number, blanks: Blank[]) {
  if (!blanks.length) return block(rows)
  const children = []
  let at = 0
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  for (const blank of [...blanks].sort((x, y) => x.offset - y.offset || +x.above - +y.above)) {
    if (blank.offset > at) children.push(block(blank.offset - at))
    children.push(spacer(blank.height, blank.span)())
    at = Math.max(at, blank.offset)
  }
  if (rows > at) children.push(block(rows - at))
  return h('div', children)
}

const modifiedOwn = sideExtension('b')
const modifiedExtensions = computed(() => [
  annotationsB,
  modifiedOwn,
  annotationsEndB,
  ...(props.extensions ?? []),
])

const editorA = ref<CodeEditorExpose>()
const editorB = ref<CodeEditorExpose>()
const sideA = ref<HTMLElement>()
const sideB = ref<HTMLElement>()
const extensionsA = [annotations('a'), sideExtension('a'), annotations('a', true)]
const annotationsB = annotations('b')
const annotationsEndB = annotations('b', true)

// Both sides scroll together; they are the same height, line for line.
const link = createScrollLink()
function onScroll(event: Event) {
  if (view.value !== 'split') return
  if (spans.value.length) schedulePlace()
  const from = (event.target as HTMLElement).closest(`.${ns.e('side')}`)
  const source = from?.querySelector<HTMLElement>('.dou-code-editor__scroller')
  if (!source || source !== event.target) return
  const other = (from === sideA.value ? sideB.value : sideA.value)?.querySelector<HTMLElement>(
    '.dou-code-editor__scroller',
  )
  if (other) link.follow(source, other)
}

// ---------------------------------------------------------------- inline

const enum Kind {
  Same,
  Removed,
  Added,
}

interface Unified {
  text: string
  kinds: Uint8Array
  /** Line numbers on each side, 0 where the line isn't there. */
  aNums: Int32Array
  bNums: Int32Array
  /** Where each line of each side is, from 1, by its number. */
  aRows: Int32Array
  bRows: Int32Array
  /** Where each change starts, from 1. */
  hunkLines: number[]
  /** Where each unchanged run starts, from 1, by key. */
  runLines: Map<number, number>
  marks: Array<{ from: number; to: number; kind: Kind }>
}

const unified = computed<Unified | null>(() => {
  if (view.value !== 'inline') return null
  const a = originalLines.value
  const b = modifiedLines.value
  const lines: string[] = []
  const kinds: number[] = []
  const aNums: number[] = []
  const bNums: number[] = []
  const hunkLines: number[] = []
  const runLines = new Map<number, number>()
  const marks: Unified['marks'] = []
  const aRows = new Int32Array(a.length + 1)
  const bRows = new Int32Array(b.length + 1)
  let pos = 0
  const push = (text: string, kind: Kind, an: number, bn: number) => {
    lines.push(text)
    kinds.push(kind)
    aNums.push(an)
    bNums.push(bn)
    if (an) aRows[an] = lines.length
    if (bn) bRows[bn] = lines.length
    pos += text.length + 1
  }
  const runs = unchanged.value
  let r = 0
  const sameUpTo = (aEnd: number) => {
    while (r < runs.length && runs[r]!.a < aEnd) {
      const run = runs[r++]!
      runLines.set(run.key, lines.length + 1)
      for (let i = 0; i < run.count; i++) push(b[run.b - 1 + i]!, Kind.Same, run.a + i, run.b + i)
    }
  }
  // Where each original and modified line starts, for moving the word marks.
  const aStarts = lineStarts(a)
  const bStarts = lineStarts(b)
  for (const hunk of hunks.value) {
    sameUpTo(hunk.originalStart)
    hunkLines.push(lines.length + 1)
    const removedAt = pos
    for (let i = 0; i < hunk.originalCount; i++)
      push(a[hunk.originalStart - 1 + i]!, Kind.Removed, hunk.originalStart + i, 0)
    const addedAt = pos
    for (let i = 0; i < hunk.modifiedCount; i++)
      push(b[hunk.modifiedStart - 1 + i]!, Kind.Added, 0, hunk.modifiedStart + i)
    const aBase = aStarts[hunk.originalStart - 1]!
    const bBase = bStarts[hunk.modifiedStart - 1]!
    for (const part of hunk.parts) {
      if (part.original.to > part.original.from)
        marks.push({
          from: removedAt + part.original.from - aBase,
          to: removedAt + part.original.to - aBase,
          kind: Kind.Removed,
        })
      if (part.modified.to > part.modified.from)
        marks.push({
          from: addedAt + part.modified.from - bBase,
          to: addedAt + part.modified.to - bBase,
          kind: Kind.Added,
        })
    }
  }
  sameUpTo(Infinity)
  return {
    text: lines.join('\n'),
    kinds: Uint8Array.from(kinds),
    aNums: Int32Array.from(aNums),
    bNums: Int32Array.from(bNums),
    aRows,
    bRows,
    hunkLines,
    runLines,
    marks,
  }
})

const digits = (n: number) => String(Math.max(1, n)).length
const numberWidth = (n: number) => digits(n) * 8 + 16

/** The line numbers of one side, in the inline view's gutter. */
const numbersOf =
  (pick: 'aNums' | 'bNums') =>
  ({ visible }: { visible: { from: number; to: number } }) => {
    const u = unified.value
    if (!u) return []
    const out: CodeGutterMarker[] = []
    const list = u[pick]
    for (let n = visible.from; n <= visible.to && n <= list.length; n++) {
      const value = list[n - 1]!
      const kind = u.kinds[n - 1]
      const tone = kind === Kind.Removed ? ' is-removed' : kind === Kind.Added ? ' is-added' : ''
      out.push({ line: n, text: value ? String(value) : '', class: `${ns.e('number')}${tone}` })
    }
    return out
  }

const inlineExtension = defineCodeExtension({
  name: 'diff',
  decorations({ visible }) {
    const u = unified.value
    if (!u) return []
    const out: CodeDecoration[] = []
    for (let n = visible.from; n <= visible.to && n <= u.kinds.length; n++) {
      const kind = u.kinds[n - 1]
      if (kind === Kind.Removed)
        out.push({ type: 'line', line: n, class: `${ns.e('line')} is-removed` })
      else if (kind === Kind.Added)
        out.push({ type: 'line', line: n, class: `${ns.e('line')} is-added` })
    }
    for (const mark of u.marks)
      out.push({
        type: 'mark',
        from: mark.from,
        to: mark.to,
        class: `${ns.e('word')} ${mark.kind === Kind.Removed ? 'is-removed' : 'is-added'}`,
      })
    return out
  },
  get gutters() {
    return [
      {
        name: 'diff-original',
        width: numberWidth(originalLines.value.length),
        markers: numbersOf('aNums'),
      },
      {
        name: 'diff-modified',
        width: numberWidth(modifiedLines.value.length),
        markers: numbersOf('bNums'),
      },
      {
        name: 'diff',
        width: 16,
        markers: ({ visible }: { visible: { from: number; to: number } }) => {
          const u = unified.value
          if (!u) return []
          const out: CodeGutterMarker[] = []
          for (let n = visible.from; n <= visible.to && n <= u.kinds.length; n++) {
            const kind = u.kinds[n - 1]
            if (kind === Kind.Removed)
              out.push({
                line: n,
                text: '−',
                class: `${ns.e('sign')} is-removed`,
                title: messages.value.diffRemoved,
              })
            else if (kind === Kind.Added)
              out.push({
                line: n,
                text: '+',
                class: `${ns.e('sign')} is-added`,
                title: messages.value.diffAdded,
              })
          }
          return out
        },
      },
    ]
  },
  widgets() {
    const u = unified.value
    if (!u) return []
    const total = u.kinds.length
    const out: CodeWidget[] = []
    for (const run of unchanged.value) {
      if (!run.hideCount) continue
      const first = u.runLines.get(run.key)! + run.hideFrom
      const last = first + run.hideCount - 1
      out.push({
        id: `bar-${run.key}`,
        ...(last < total ? { line: last + 1, position: 'above' as const } : { line: first - 1 }),
        height: BAR_HEIGHT,
        render: () => bar(run),
      })
    }
    return out
  },
  hide() {
    const u = unified.value
    if (!u) return []
    const out: Array<{ from: number; to: number }> = []
    for (const run of unchanged.value) {
      if (!run.hideCount) continue
      const first = u.runLines.get(run.key)! + run.hideFrom
      out.push({ from: first, to: first + run.hideCount - 1 })
    }
    return out
  },
})
const inlineExtensions = [inlineAnnotations(), inlineExtension, inlineAnnotations(true)]
const editorInline = ref<CodeEditorExpose>()
const inlineBox = ref<HTMLElement>()

// ---------------------------------------------------------------- markers and widgets of both texts

/** One line's height, before the editors have measured theirs. */
const LINE = 20
const sideName = (side: Side): CodeDiffSide => (side === 'a' ? 'original' : 'modified')

/** The widgets' measured heights, by id, for the blank left beside each. */
const heights = reactive(new Map<string, number>())
let heightObserver: ResizeObserver | undefined
/** The element each widget's content is drawn in now, by id, and back. */
const measuredEls = new Map<string, Element>()
const measuredIds = new Map<Element, string>()
function readHeight(box: Element, entry?: ResizeObserverEntry) {
  const id = measuredIds.get(box)
  // The size the observer saw: by the time it says so, the editor may have
  // moved on and taken the widget away, which leaves nothing to measure.
  const size = entry?.borderBoxSize?.[0]?.blockSize ?? entry?.contentRect.height
  const height = size === undefined ? (box as HTMLElement).offsetHeight : Math.round(size)
  // Nothing measured means no layout (hidden): keep the guess.
  if (id && height && heights.get(id) !== height) heights.set(id, height)
}
function forget(box: Element) {
  heightObserver?.unobserve(box)
  measuredIds.delete(box)
}
/** Measures a widget across both sides as drawn, now and whenever it resizes; `null` once it is gone. */
function measure(el: Element | null, id: string) {
  const had = measuredEls.get(id)
  if (!el) {
    // the old element going after a new one came, e.g. on switching views, keeps the new one
    if (had && !had.isConnected) {
      forget(had)
      measuredEls.delete(id)
    }
    return
  }
  if (had === el) return
  if (had) forget(had)
  measuredEls.set(id, el)
  measuredIds.set(el, id)
  readHeight(el)
  if (typeof ResizeObserver === 'undefined') return
  heightObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) readHeight(entry.target, entry)
  })
  heightObserver.observe(el)
}
onBeforeUnmount(() => heightObserver?.disconnect())

const heightOf = (widget: CodeDiffWidget) => heights.get(widget.id) ?? widget.height ?? LINE

// The editors measure the widgets they draw and say so here: one height for the widget and its blank.
const widgetIds = computed(() => new Set((props.widgets ?? []).map((widget) => widget.id)))
provide(WIDGET_HEIGHT_KEY, (key, height) => {
  if (!key.startsWith('diff-widgets')) return
  const id = key.slice(key.indexOf('/') + 1)
  if (widgetIds.value.has(id) && heights.get(id) !== height) heights.set(id, height)
})

/** A widget's own content. */
const content = (widget: CodeDiffWidget) => () =>
  h('div', { class: ns.e('widget') }, [widget.render()])

/** The blank across from a widget; `span` marks where a widget across both sides is drawn. */
const spacer = (height: number, span?: string) => () =>
  h('div', {
    class: ns.e('spacer'),
    style: { height: `${height}px` },
    'data-diff-span': span,
  })

/** A blank inside a filler: `offset` rows into it. */
interface Blank {
  offset: number
  above: boolean
  height: number
  span?: string
}
interface SidePlan {
  /** Widgets below lines, drawn before the diff's own; above lines, after them. */
  below: CodeWidget[]
  above: CodeWidget[]
  /** Blanks inside the fillers, by change. */
  fills: Map<number, Blank[]>
}

/**
 * Where a spot beside line `line` of `side` is on the other side: beside
 * a line there, or inside the filler of a change.
 */
function across(
  side: Side,
  line: number,
  above: boolean,
): { line: number } | { fill: number; offset: number } | null {
  const list = hunks.value
  for (let i = 0; i < list.length; i++) {
    const hunk = list[i]!
    const start = side === 'a' ? hunk.originalStart : hunk.modifiedStart
    const count = side === 'a' ? hunk.originalCount : hunk.modifiedCount
    if (line < start) break
    if (line >= start + count) continue
    const otherStart = side === 'a' ? hunk.modifiedStart : hunk.originalStart
    const otherCount = side === 'a' ? hunk.modifiedCount : hunk.originalCount
    const index = line - start
    if (index < otherCount) return { line: otherStart + index }
    return { fill: i, offset: index - otherCount + (above ? 0 : 1) }
  }
  for (const run of unchanged.value) {
    const start = side === 'a' ? run.a : run.b
    if (line >= start && line < start + run.count)
      return { line: line - start + (side === 'a' ? run.b : run.a) }
  }
  return null
}

/** Side by side: each widget on its side, a blank of its height on the other. */
// Heights are kept by id across both sides, so one id twice mixes them up.
if (process.env.NODE_ENV !== 'production') {
  const warned = new Set<string>()
  watch(
    () => props.widgets,
    (widgets) => {
      const seen = new Set<string>()
      for (const widget of widgets ?? []) {
        if (seen.has(widget.id) && !warned.has(widget.id)) {
          warned.add(widget.id)
          console.warn(
            `[@dou-ui/code] DouCodeDiff: widget id "${widget.id}" is used more than once; ids must be unique across both sides.`,
          )
        }
        seen.add(widget.id)
      }
    },
    { immediate: true },
  )
}

const splitPlan = computed(() => {
  const plan: Record<Side, SidePlan> = {
    a: { below: [], above: [], fills: new Map() },
    b: { below: [], above: [], fills: new Map() },
  }
  if (view.value !== 'split') return plan
  for (const widget of props.widgets ?? []) {
    const own: Side = widget.side === 'original' ? 'a' : 'b'
    const other: Side = own === 'a' ? 'b' : 'a'
    const lines = own === 'a' ? originalLines.value.length : modifiedLines.value.length
    if (!(widget.line >= 1 && widget.line <= lines)) continue
    const above = widget.position === 'above'
    const height = heightOf(widget)
    const span = widget.span === 'both' ? widget.id : undefined
    const put = (
      side: Side,
      line: number,
      render: () => VNodeChild,
      label?: string,
      blank = false,
    ) =>
      plan[side][above ? 'above' : 'below'].push({
        // A blank's height is known: in its id, so the editor never keeps one it measured before.
        id: blank ? `${widget.id}~${height}` : widget.id,
        line,
        position: above ? 'above' : 'below',
        height,
        label,
        render,
      })
    // Across both sides, the widget itself is drawn over the blanks, with its label.
    if (span) put(own, widget.line, spacer(height, span), widget.label, true)
    else put(own, widget.line, content(widget), widget.label)
    const spot = across(own, widget.line, above)
    if (!spot) continue
    if ('fill' in spot) {
      const fills = plan[other].fills
      const blanks = fills.get(spot.fill) ?? []
      blanks.push({ offset: spot.offset, above, height, span })
      fills.set(spot.fill, blanks)
    } else put(other, spot.line, spacer(height, span), undefined, true)
  }
  return plan
})

/** The widgets drawn across both sides, over them. */
const spans = computed(() =>
  view.value === 'split' ? (props.widgets ?? []).filter((widget) => widget.span === 'both') : [],
)

/** Whether a column's `hoverMarker` goes on the lines of `side`. */
function hoversOn(gutter: CodeDiffGutter, side: CodeDiffSide) {
  return !!gutter.hoverMarker && (!gutter.hoverMarker.side || gutter.hoverMarker.side === side)
}

/** Whether a column has a marker of its own on line `line` of `side`. */
function ownMarkerOn(gutter: CodeDiffGutter, side: CodeDiffSide, line: number) {
  return line > 0 && (gutter.markers ?? []).some((m) => m.side === side && m.line === line)
}

/**
 * Which line of which side a press on a column goes to, or `null` for none.
 * A column whose `hoverMarker` is on one side only answers presses on the
 * other side's own markers, not on its empty cells.
 */
function pressedOn(gutter: CodeDiffGutter, side: CodeDiffSide, line: number): CodeDiffSide | null {
  if (!gutter.hoverMarker || hoversOn(gutter, side) || ownMarkerOn(gutter, side, line)) return side
  return null
}

/** The column's `hoverMarker` as the editor of one side takes it, named for that side. */
function hoverMarkerOf(hover: CodeDiffHoverMarker, side: CodeDiffSide): CodeGutterHoverMarker {
  const { title } = hover
  return {
    icon: hover.icon,
    text: hover.text,
    class: hover.class,
    title: typeof title === 'function' ? (line: number) => title(line, side) : title,
  }
}

/** A column of `gutters` as one side's editor draws it. */
function sideGutter(gutter: CodeDiffGutter, side: Side) {
  const name = sideName(side)
  return {
    name: gutter.name,
    width: gutter.width,
    markers: ({ visible }: { visible: { from: number; to: number } }) =>
      (gutter.markers ?? []).filter(
        (marker) =>
          marker.side === name && marker.line >= visible.from && marker.line <= visible.to,
      ),
    hoverMarker: hoversOn(gutter, name) ? hoverMarkerOf(gutter.hoverMarker!, name) : undefined,
    // on one side only, the other side's empty cells take no press
    pressOn: gutter.hoverMarker?.side ? ('markers' as const) : gutter.pressOn,
    onPress:
      gutter.onPress &&
      ((line: number, event: PointerEvent | KeyboardEvent) => {
        if (pressedOn(gutter, name, line)) gutter.onPress!(line, event, name)
      }),
  }
}

/**
 * The `gutters` and `widgets` of one side. Two of them go around the
 * diff's own: widgets below a line come before its filler or bar, those
 * above a line after them.
 */
function annotations(side: Side, end = false): CodeExtension {
  return defineCodeExtension({
    name: end ? 'diff-widgets-end' : 'diff-widgets',
    get gutters() {
      return end ? [] : (props.gutters ?? []).map((gutter) => sideGutter(gutter, side))
    },
    widgets: () => splitPlan.value[side][end ? 'above' : 'below'],
  })
}

/** Where line `line` of `side` is inline, from 1; 0 when it isn't there. */
function inlineRow(u: Unified, side: CodeDiffSide, line: number) {
  const rows = side === 'original' ? u.aRows : u.bRows
  return line >= 1 && line < rows.length ? rows[line]! : 0
}

/** The `gutters` and `widgets` inline, on the rows of their lines. */
function inlineAnnotations(end = false): CodeExtension {
  return defineCodeExtension({
    name: end ? 'diff-widgets-end' : 'diff-widgets',
    get gutters() {
      if (end) return []
      return (props.gutters ?? []).map((gutter) => ({
        name: gutter.name,
        width: gutter.width,
        // on one side only, rows of just the other side take no press
        pressOn: gutter.hoverMarker?.side ? ('markers' as const) : gutter.pressOn,
        markers: ({ visible }: { visible: { from: number; to: number } }) => {
          const u = unified.value
          if (!u) return []
          const out: CodeGutterMarker[] = []
          const taken = new Set<number>()
          // The modified side's marker wins on a row both share.
          for (const side of ['modified', 'original'] as const)
            for (const marker of gutter.markers ?? []) {
              if (marker.side !== side) continue
              const row = inlineRow(u, side, marker.line)
              if (!row || row < visible.from || row > visible.to || taken.has(row)) continue
              out.push({ ...marker, line: row })
              taken.add(row)
            }
          if (gutter.hoverMarker)
            for (let row = visible.from; row <= visible.to && row <= u.kinds.length; row++) {
              if (taken.has(row)) continue
              const b = u.bNums[row - 1] ?? 0
              const a = u.aNums[row - 1] ?? 0
              // named for the line and side a press here goes to
              const at: [number, CodeDiffSide] | null =
                b && hoversOn(gutter, 'modified')
                  ? [b, 'modified']
                  : a && hoversOn(gutter, 'original')
                    ? [a, 'original']
                    : null
              if (!at) continue
              const { icon, text, class: className, title } = gutter.hoverMarker
              out.push({
                icon,
                text,
                class: className,
                title: typeof title === 'function' ? title(at[0], at[1]) : title,
                line: row,
                visible: 'hover',
              })
            }
          return out
        },
        onPress:
          gutter.onPress &&
          ((row: number, event: PointerEvent | KeyboardEvent) => {
            const u = unified.value
            if (!u) return
            const a = u.aNums[row - 1] ?? 0
            const b = u.bNums[row - 1] ?? 0
            const press = (side: CodeDiffSide, line: number) => gutter.onPress!(line, event, side)
            if (ownMarkerOn(gutter, 'modified', b)) return press('modified', b)
            if (ownMarkerOn(gutter, 'original', a)) return press('original', a)
            if (!gutter.hoverMarker) return b ? press('modified', b) : press('original', a)
            // with a hoverMarker on one side, an empty row of the other side isn't one to press
            if (b && hoversOn(gutter, 'modified')) press('modified', b)
            else if (a && hoversOn(gutter, 'original')) press('original', a)
          }),
      }))
    },
    widgets() {
      const u = unified.value
      if (!u) return []
      const out: CodeWidget[] = []
      for (const widget of props.widgets ?? []) {
        if ((widget.position === 'above') !== end) continue
        const row = inlineRow(u, widget.side, widget.line)
        if (!row) continue
        out.push({
          id: widget.id,
          line: row,
          position: widget.position,
          height: heightOf(widget),
          label: widget.label,
          render: content(widget),
        })
      }
      return out
    },
  })
}

// ---------------------------------------------------------------- widgets across both sides

const spanLayer = ref<HTMLElement>()
/** Where the layer of widgets across both sides is: over the text of the sides. */
const spanBox = ref({ top: 0, height: 0 })
/** Each widget's y in the layer, by id; left out while its blank isn't drawn. */
const spanTops = ref<Record<string, number>>({})

let placeFrame = 0
function schedulePlace() {
  if (!placeFrame && typeof requestAnimationFrame !== 'undefined')
    placeFrame = requestAnimationFrame(placeSpans)
}
/** Puts each widget across both sides over its blank. */
function placeSpans() {
  placeFrame = 0
  const body = spanLayer.value?.parentElement
  const scroller = sideA.value?.querySelector<HTMLElement>('.dou-code-editor__scroller')
  if (!body || !scroller) return
  const frame = scroller.getBoundingClientRect()
  const top = frame.top - body.getBoundingClientRect().top
  if (spanBox.value.top !== top || spanBox.value.height !== frame.height)
    spanBox.value = { top, height: frame.height }
  const tops: Record<string, number> = {}
  for (const box of [sideA.value, sideB.value])
    for (const el of box?.querySelectorAll<HTMLElement>('[data-diff-span]') ?? []) {
      const id = el.dataset.diffSpan!
      if (!(id in tops)) tops[id] = el.getBoundingClientRect().top - frame.top
    }
  const had = spanTops.value
  const keys = Object.keys(tops)
  if (keys.length !== Object.keys(had).length || keys.some((id) => had[id] !== tops[id]))
    spanTops.value = tops
}

// Blanks move when the text scrolls, a widget above grows, or the box resizes.
let stopPlacing: (() => void) | undefined
function startPlacing() {
  stopPlacing?.()
  stopPlacing = undefined
  if (!spans.value.length || !sideA.value) return
  placeSpans()
  const moved = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedulePlace)
  for (const side of [sideA.value, sideB.value])
    if (side) moved?.observe(side, { subtree: true, childList: true, attributeFilter: ['style'] })
  const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePlace)
  if (root.value) resized?.observe(root.value)
  stopPlacing = () => {
    moved?.disconnect()
    resized?.disconnect()
    if (placeFrame) cancelAnimationFrame(placeFrame)
    placeFrame = 0
  }
}
watch(() => spans.value.length > 0 && view.value, startPlacing, { flush: 'post' })
onMounted(startPlacing)
onBeforeUnmount(() => stopPlacing?.())

/**
 * While the text scrolls, the widgets across both sides are hidden: placed a
 * frame late, they would trail behind it. They come back once it rests.
 */
const spansScrolling = ref(false)
let restTimer: ReturnType<typeof setTimeout> | undefined
function onSideScroll() {
  if (!spans.value.length) return
  spansScrolling.value = true
  clearTimeout(restTimer)
  restTimer = setTimeout(() => {
    spansScrolling.value = false
    placeSpans()
  }, 120)
}
onBeforeUnmount(() => clearTimeout(restTimer))

/** A wheel over a widget across both sides scrolls the text under it. */
function onSpanWheel(event: WheelEvent) {
  const scroller = sideB.value?.querySelector<HTMLElement>('.dou-code-editor__scroller')
  if (!scroller) return
  const unit = event.deltaMode === 1 ? LINE : event.deltaMode === 2 ? scroller.clientHeight : 1
  const dy = event.deltaY * unit
  const dx = event.deltaX * unit
  const canY =
    dy < 0
      ? scroller.scrollTop > 0
      : dy > 0 && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1
  const canX =
    dx < 0
      ? scroller.scrollLeft > 0
      : dx > 0 && scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
  // At the end, the page scrolls on as it would over the text.
  if (!canY && !canX) return
  event.preventDefault()
  if (canY) scroller.scrollTop += dy
  if (canX) scroller.scrollLeft += dx
}

// ---------------------------------------------------------------- hidden lines a cursor reaches

/** Shows the run of hidden lines a cursor moved into, e.g. with search. */
function revealAt(side: Side | 'inline', result: CodeTransactionResult) {
  if (!hiddenCount.value) return
  const { doc, selection } = result.state
  const u = unified.value
  for (const range of selection.ranges) {
    const line = doc.lineAt(range.head).number
    for (const run of unchanged.value) {
      if (!run.hideCount) continue
      const start =
        side === 'inline' ? (u?.runLines.get(run.key) ?? 0) : side === 'a' ? run.a : run.b
      const first = start + run.hideFrom
      if (line >= first && line < first + run.hideCount) open(run.key)
    }
  }
}

// ---------------------------------------------------------------- going from change to change

const live = ref('')
const current = ref(-1)

function target(): { editor: CodeEditorExpose; box: HTMLElement; side: Side | 'inline' } | null {
  if (view.value === 'inline')
    return editorInline.value && inlineBox.value
      ? { editor: editorInline.value, box: inlineBox.value, side: 'inline' }
      : null
  const inA = !!sideA.value?.contains(document.activeElement)
  const editor = inA ? editorA.value : editorB.value
  const box = inA ? sideA.value : sideB.value
  return editor && box ? { editor, box, side: inA ? 'a' : 'b' } : null
}

function lineOf(index: number, side: Side | 'inline') {
  const hunk = hunks.value[index]!
  if (side === 'inline') return unified.value?.hunkLines[index] ?? 1
  return side === 'a' ? hunk.originalStart : hunk.modifiedStart
}

function go(step: 1 | -1) {
  const list = hunks.value
  const t = target()
  if (!list.length || !t) return false
  const doc = t.editor.doc
  const at = doc.lineAt(t.editor.selection.ranges[t.editor.selection.main]!.head).number
  let index = -1
  if (step > 0) {
    index = list.findIndex((_, i) => lineOf(i, t.side) > at)
    if (index < 0) index = 0
  } else {
    for (let i = list.length - 1; i >= 0; i--)
      if (lineOf(i, t.side) < at) {
        index = i
        break
      }
    if (index < 0) index = list.length - 1
  }
  const line = Math.min(doc.lines, Math.max(1, lineOf(index, t.side)))
  t.editor.select(doc.line(line).from)
  current.value = index
  const hunk = list[index]!
  live.value = format(messages.value.diffChangeAt, {
    index: index + 1,
    count: list.length,
    line: hunk.modifiedStart,
    removed: hunk.originalCount,
    added: hunk.modifiedCount,
  })
  // The editor may grow with the page instead of scrolling: bring the cursor into the window too.
  nextTick(() => t.box.querySelector('textarea')?.scrollIntoView({ block: 'nearest' }))
  return true
}

const keymap: CodeKeymap = {
  f7: () => go(1),
  'shift+f7': () => go(-1),
}

function next() {
  return go(1)
}
function previous() {
  return go(-1)
}

const summary = computed(() =>
  hunks.value.length ? format(messages.value.diffStats, stats.value) : messages.value.diffNoChanges,
)

defineExpose({
  /** The changes found now. */
  get hunks() {
    return hunks.value
  },
  /** Moves to the next change; `false` when there is none. */
  next,
  /** Moves to the previous change. */
  previous,
  /** Shows every unchanged line. */
  expandAll: () => (allOpen.value = true),
  /** Hides the runs of unchanged lines again. */
  collapseAll: () => {
    allOpen.value = false
    opened.clear()
  },
  /** The editors drawn now: both sides, or the inline one as `modified`. */
  get original() {
    return view.value === 'split' ? editorA.value : undefined
  },
  get modified() {
    return view.value === 'split' ? editorB.value : editorInline.value
  },
})
</script>

<template>
  <div
    ref="root"
    :class="[ns.b(), ns.m(view), ns.is('bordered', bordered)]"
    role="group"
    :aria-label="messages.diff"
  >
    <div v-if="toolbar" :class="ns.e('toolbar')">
      <span :class="ns.e('stats')">
        <template v-if="hunks.length">
          <span :class="[ns.e('count'), 'is-added']" aria-hidden="true">+{{ stats.added }}</span>
          <span :class="[ns.e('count'), 'is-removed']" aria-hidden="true"
            >−{{ stats.removed }}</span
          >
          <span :class="ns.e('hidden-text')">{{ summary }}</span>
        </template>
        <span v-else :class="ns.e('summary')">{{ summary }}</span>
      </span>
      <DouTooltip :content="messages.diffPrevious" shortcut="shift+f7">
        <DouButton
          variant="ghost"
          size="sm"
          :disabled="!hunks.length"
          :aria-label="messages.diffPrevious"
          @click="previous"
        >
          <ArrowUpIcon />
        </DouButton>
      </DouTooltip>
      <DouTooltip :content="messages.diffNext" shortcut="f7">
        <DouButton
          variant="ghost"
          size="sm"
          :disabled="!hunks.length"
          :aria-label="messages.diffNext"
          @click="next"
        >
          <ArrowDownIcon />
        </DouButton>
      </DouTooltip>
      <DouTooltip
        v-if="anyHideable"
        :content="hiddenCount ? messages.diffExpandAll : messages.diffCollapse"
      >
        <DouButton
          variant="ghost"
          size="sm"
          :aria-label="hiddenCount ? messages.diffExpandAll : messages.diffCollapse"
          @click="toggleAll"
        >
          <UnfoldVerticalIcon v-if="hiddenCount" />
          <FoldVerticalIcon v-else />
        </DouButton>
      </DouTooltip>
      <DouTooltip :content="view === 'split' ? messages.diffInline : messages.diffSplit">
        <DouButton
          variant="ghost"
          size="sm"
          :aria-label="view === 'split' ? messages.diffInline : messages.diffSplit"
          @click="toggleView"
        >
          <DiffUnifiedIcon v-if="view === 'split'" />
          <DiffSplitIcon v-else />
        </DouButton>
      </DouTooltip>
    </div>
    <div v-if="view === 'split'" :class="ns.e('body')" @scroll.capture="onScroll">
      <div :class="ns.e('label')">{{ messages.diffOriginal }}</div>
      <div :class="ns.e('label')">{{ messages.diffModified }}</div>
      <div
        ref="sideA"
        @scroll.capture.passive="onSideScroll"
        :class="[ns.e('side'), 'is-original']"
      >
        <CodeEditor
          ref="editorA"
          :model-value="original"
          :language="language"
          :extensions="extensionsA"
          :tab-size="tabSize"
          :messages="messages"
          :keymap="keymap"
          :aria-label="messages.diffOriginal"
          :foldable="false"
          :active-line="false"
          :bordered="false"
          readonly
          @transaction="revealAt('a', $event)"
        />
      </div>
      <div
        ref="sideB"
        @scroll.capture.passive="onSideScroll"
        :class="[ns.e('side'), 'is-modified']"
      >
        <CodeEditor
          ref="editorB"
          :model-value="modified"
          :language="language"
          :extensions="modifiedExtensions"
          :tab-size="tabSize"
          :messages="messages"
          :keymap="keymap"
          :aria-label="messages.diffModified"
          :foldable="false"
          :active-line="false"
          :bordered="false"
          :readonly="!editable"
          @update:model-value="onModifiedInput"
          @transaction="revealAt('b', $event)"
        />
      </div>
      <div
        v-if="spans.length"
        ref="spanLayer"
        :class="ns.e('spans')"
        :style="{ top: `${spanBox.top}px`, height: `${spanBox.height}px` }"
      >
        <div
          v-for="widget in spans"
          :key="widget.id"
          :ref="(el) => measure(el as Element | null, widget.id)"
          :class="[ns.e('span'), ns.is('placed', widget.id in spanTops && !spansScrolling)]"
          :style="{ transform: `translateY(${spanTops[widget.id] ?? 0}px)` }"
          :role="widget.label ? 'group' : undefined"
          :aria-label="widget.label"
          @wheel="onSpanWheel"
        >
          <RenderPart :render="widget.render" />
        </div>
      </div>
    </div>
    <div v-else ref="inlineBox" :class="ns.e('body')">
      <CodeEditor
        ref="editorInline"
        :model-value="unified?.text ?? ''"
        :language="language"
        :extensions="inlineExtensions"
        :tab-size="tabSize"
        :messages="messages"
        :keymap="keymap"
        :aria-label="messages.diff"
        :line-numbers="false"
        :foldable="false"
        :active-line="false"
        :bordered="false"
        :wrap="wrap"
        readonly
        @transaction="revealAt('inline', $event)"
      />
    </div>
    <div :class="ns.e('live')" aria-live="polite">{{ live }}</div>
  </div>
</template>
