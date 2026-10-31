<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DiffSplitIcon,
  DiffUnifiedIcon,
  FoldVerticalIcon,
  UnfoldVerticalIcon,
} from '@dou-ui/icons'
import { DouButton, DouTooltip, useNamespace } from 'dou-ui'
import { computed, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import CodeEditor from './code-editor.vue'
import { type CodeDiffHunk, diffText, lineStarts } from './core/diff'
import type { CodeKeymap } from './core/keymap'
import type { CodeTransactionResult } from './core/transaction'
import { splitLines } from './core/text'
import {
  type CodeDecoration,
  type CodeExtension,
  type CodeGutterMarker,
  type CodeWidget,
  defineCodeExtension,
} from './extension'
import { format, useCodeMessages } from './locale'
import type { CodeDiffEmits, CodeDiffProps, CodeEditorExpose } from './types'

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
  tabSize: 2,
  toolbar: true,
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
  let a = 1
  let b = 1
  for (let i = 0; i < list.length; i++) {
    const hunk = list[i]!
    push(a, b, hunk.originalStart - a, i > 0, true)
    a = hunk.originalStart + hunk.originalCount
    b = hunk.modifiedStart + hunk.modifiedCount
  }
  push(a, b, total - a + 1, list.length > 0, false)
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
      hunks.value.forEach((hunk, i) => {
        const missing = otherCountOf(hunk) - countOf(hunk)
        if (missing <= 0) return
        const last = startOf(hunk) - 1 + countOf(hunk)
        out.push({
          id: `fill-${i}`,
          ...(last >= 1 ? { line: last } : { line: 1, position: 'above' as const }),
          height: missing * 20,
          render: () =>
            h('div', {
              class: ns.e('filler'),
              style: { height: `calc(${missing} * var(--dou-code-editor-line-height))` },
            }),
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

const modifiedOwn = sideExtension('b')
const modifiedExtensions = computed(() => [modifiedOwn, ...(props.extensions ?? [])])

const editorA = ref<CodeEditorExpose>()
const editorB = ref<CodeEditorExpose>()
const sideA = ref<HTMLElement>()
const sideB = ref<HTMLElement>()
const extensionsA = [sideExtension('a')]

// Both sides scroll together; they are the same height, line for line.
let syncing: HTMLElement | null = null
function onScroll(event: Event) {
  if (view.value !== 'split') return
  const from = (event.target as HTMLElement).closest(`.${ns.e('side')}`)
  const source = from?.querySelector<HTMLElement>('.dou-code-editor__scroller')
  if (!source || source !== event.target || syncing === source) return
  const other = (from === sideA.value ? sideB.value : sideA.value)?.querySelector<HTMLElement>(
    '.dou-code-editor__scroller',
  )
  if (!other) return
  if (other.scrollTop === source.scrollTop && other.scrollLeft === source.scrollLeft) return
  syncing = other
  other.scrollTop = source.scrollTop
  other.scrollLeft = source.scrollLeft
  requestAnimationFrame(() => {
    if (syncing === other) syncing = null
  })
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
  let pos = 0
  const push = (text: string, kind: Kind, an: number, bn: number) => {
    lines.push(text)
    kinds.push(kind)
    aNums.push(an)
    bNums.push(bn)
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
const inlineExtensions = [inlineExtension]
const editorInline = ref<CodeEditorExpose>()
const inlineBox = ref<HTMLElement>()

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
  <div ref="root" :class="[ns.b(), ns.m(view)]" role="group" :aria-label="messages.diff">
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
      <div ref="sideA" :class="[ns.e('side'), 'is-original']">
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
          readonly
          @transaction="revealAt('a', $event)"
        />
      </div>
      <div ref="sideB" :class="[ns.e('side'), 'is-modified']">
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
          :readonly="!editable"
          @update:model-value="onModifiedInput"
          @transaction="revealAt('b', $event)"
        />
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
        :wrap="wrap"
        readonly
        @transaction="revealAt('inline', $event)"
      />
    </div>
    <div :class="ns.e('live')" aria-live="polite">{{ live }}</div>
  </div>
</template>
