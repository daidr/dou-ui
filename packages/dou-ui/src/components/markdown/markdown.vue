<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
import { useReducedMotion } from '../../composables/use-motion'
import { useNamespace } from '../../utils/namespace'
import { safeCut } from '../stream-text/stream-text'
import type {
  MarkdownBlock,
  MarkdownEmits,
  MarkdownExpose,
  MarkdownProps,
  MarkdownSlots,
} from './markdown'
import { createMarkdownParser } from './parser'
import {
  markdownContextKey,
  MarkdownChunkView,
  type MarkdownCommit,
  type MarkdownRenderContext,
} from './render'
import { defaultSanitizeUrl } from './url'

defineOptions({ name: 'DouMarkdown' })

const props = withDefaults(defineProps<MarkdownProps>(), {
  content: '',
  streaming: false,
  smooth: true,
  speed: 60,
  caret: false,
  linkTarget: '_blank',
})
const emit = defineEmits<MarkdownEmits>()
const slots = defineSlots<MarkdownSlots>()

const ns = useNamespace('markdown')
const reducedMotion = useReducedMotion()

/** The fade of new content; the same as the `--dou-motion-duration-slow` token. */
const FADE = 320
/** Blocks per chunk: a chunk that is complete is skipped as a whole. */
const CHUNK = 32

const parser = createMarkdownParser()
// How much of `content` is shown, in UTF-16 units. What is there at mount shows at once.
const shown = ref(props.content.length)
let committed = props.content.length
let committedText = props.content
let committedFinal = !props.streaming
const blocks = shallowRef<MarkdownBlock[]>(parser.update(props.content, committedFinal))
const tick = ref(0)

const commits: MarkdownCommit[] = []
const ctx: MarkdownRenderContext = {
  get streaming() {
    return props.streaming
  },
  get sources() {
    return props.sources
  },
  get linkTarget() {
    return props.linkTarget
  },
  slots,
  sanitize: (url, kind) => (props.sanitizeUrl ?? defaultSanitizeUrl)(url, kind),
  commits,
  duration: FADE,
  now: 0,
  delays: new Map(),
  caret: null,
}
provide(markdownContextKey, ctx)

let mounted = false
const animate = () => mounted && props.smooth && !reducedMotion.value

/** The last leaf, where the caret goes. */
function caretTarget(list: MarkdownBlock[]): object | null {
  let node: MarkdownBlock | MarkdownBlock[] | undefined = list[list.length - 1]
  for (;;) {
    if (!node) return null
    if (Array.isArray(node)) node = node[node.length - 1]
    else if (node.type === 'blockquote') node = node.children[node.children.length - 1]
    else if (node.type === 'list') {
      const item = node.children[node.children.length - 1]
      if (!item) return null
      const child = item.children[item.children.length - 1]
      if (!child) return item
      node = child
    } else if (node.type === 'table') return node.rows[node.rows.length - 1] ?? node.head
    else if (node.type === 'paragraph' || node.type === 'heading') return node
    else return null
  }
}

// complete chunks are kept, so the same array goes back to the same component
let chunks: MarkdownBlock[][] = []
function chunkOf(list: MarkdownBlock[]): MarkdownBlock[][] {
  const next: MarkdownBlock[][] = []
  for (let from = 0; from < list.length; from += CHUNK) {
    const index = from / CHUNK
    const prev = chunks[index]
    const to = Math.min(from + CHUNK, list.length)
    if (prev && prev.length === to - from && prev.every((block, i) => block === list[from + i]))
      next.push(prev)
    else next.push(list.slice(from, to))
  }
  chunks = next
  return next
}
const chunked = shallowRef(chunkOf(blocks.value))

let cleanup: ReturnType<typeof setTimeout> | undefined
function commit(now: number) {
  const final = !props.streaming && shown.value >= props.content.length
  if (animate() && shown.value > committed) commits.push({ from: committed, time: now })
  // fades that are over need no span any more
  while (commits.length && now - commits[0]!.time >= FADE) {
    const old = commits.shift()!
    for (const key of ctx.delays.keys()) if (key.endsWith(`:${old.from}`)) ctx.delays.delete(key)
  }
  committedText = props.content.slice(0, shown.value)
  committed = shown.value
  committedFinal = final
  ctx.now = now
  blocks.value = parser.update(committedText, final)
  chunked.value = chunkOf(blocks.value)
  tick.value++
  clearTimeout(cleanup)
  // one more render once the last fade ends, to merge its spans back into text
  if (commits.length) cleanup = setTimeout(() => commit(performance.now()), FADE + 20)
}

let frame = 0
let last = 0
let carry = 0
function step(now: number) {
  frame = 0
  const total = props.content.length
  if (animate()) {
    const elapsed = last ? Math.min(now - last, 100) : 16
    last = now
    const backlog = total - shown.value
    // at least `speed`, and fast enough to catch up in a moment
    const rate = Math.max(props.speed, backlog / (props.streaming ? 0.4 : 0.25))
    carry += (rate * elapsed) / 1000
    const advance = Math.floor(carry)
    if (advance > 0) {
      carry -= advance
      shown.value = safeCut(props.content, Math.min(total, shown.value + advance))
    }
  } else shown.value = total
  const final = !props.streaming && shown.value >= total
  if (shown.value !== committed || final !== committedFinal) commit(now)
  if (shown.value < total) frame = requestAnimationFrame(step)
  else last = 0
}

function schedule() {
  if (!mounted || typeof requestAnimationFrame === 'undefined') {
    shown.value = props.content.length
    commit(0)
    return
  }
  if (!frame) frame = requestAnimationFrame(step)
}

function flush() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  last = 0
  carry = 0
  shown.value = props.content.length
  commit(typeof performance === 'undefined' ? 0 : performance.now())
}

watch(
  () => props.content,
  (value) => {
    // replaced rather than extended: keep what still matches
    if (!value.startsWith(committedText)) {
      let common = 0
      const limit = Math.min(value.length, committedText.length)
      while (common < limit && value.charCodeAt(common) === committedText.charCodeAt(common))
        common++
      shown.value = safeCut(value, common)
      committed = Math.min(committed, shown.value)
      while (commits.length && commits[commits.length - 1]!.from >= shown.value) commits.pop()
    }
    schedule()
  },
)
watch(() => props.streaming, schedule)
watch(
  () => props.smooth,
  (smooth) => {
    if (!smooth) flush()
  },
)

const done = computed(() => !props.streaming && shown.value >= props.content.length)
watch(done, (value) => {
  if (value) emit('done')
})

onMounted(() => {
  mounted = true
})
onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
  clearTimeout(cleanup)
})

defineExpose<MarkdownExpose>({ flush })

// Renders the blocks. The caret target is set here, untracked, so that
// moving the caret does not re-render every block that checks for it.
function Body() {
  ctx.caret = props.caret && !done.value ? caretTarget(blocks.value) : null
  const list = chunked.value
  const children = list.map((chunk, index) =>
    h(MarkdownChunkView, {
      key: index,
      blocks: chunk,
      tick: index === list.length - 1 ? tick.value : 0,
    }),
  )
  if (props.caret && !done.value && !ctx.caret)
    children.push(h('span', { key: 'caret', class: ns.e('caret'), 'aria-hidden': 'true' }))
  return children
}
</script>

<template>
  <div :class="[ns.b(), ns.is('streaming', !done)]" :aria-busy="done ? undefined : 'true'">
    <Body />
  </div>
</template>
