<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useGlobalConfig, useLocale } from '../config-provider/use-config'
import { DouCopyButton } from '../copy-button'
import type {
  CodeBlockEmits,
  CodeBlockExpose,
  CodeBlockHighlighter,
  CodeBlockProps,
  CodeBlockSlots,
} from './code-block'
import { htmlLines, parseLines, plainLines } from './lines'

defineOptions({ name: 'DouCodeBlock' })

const props = withDefaults(defineProps<CodeBlockProps>(), {
  code: '',
  lang: 'text',
  lineNumbers: false,
  startLine: 1,
  wrap: false,
  maxHeight: undefined,
  copyable: true,
  streaming: false,
  autoScroll: undefined,
  bordered: true,
})
const emit = defineEmits<CodeBlockEmits>()
const slots = defineSlots<CodeBlockSlots>()

const ns = useNamespace('code-block')
const { t } = useLocale()
const config = useGlobalConfig()
const bodyId = `dou-code-block-${useId()}`

// A function prop cannot take its default from ConfigProvider the way
// other props do, so the configured one is read here.
const highlighter = computed<CodeBlockHighlighter | undefined>(
  () =>
    props.highlight ??
    (config.value.defaults as { DouCodeBlock?: { highlight?: CodeBlockHighlighter } }).DouCodeBlock
      ?.highlight,
)

const code = computed(() => props.code.replace(/\n$/, ''))

const split = computed(() => {
  const raw = props.code
  // while streaming, the line still being written stays plain
  if (!props.streaming) return { source: code.value, tail: '' }
  const cut = raw.lastIndexOf('\n') + 1
  return {
    source: raw.slice(0, cut).replace(/\n$/, ''),
    tail: raw.slice(cut),
  }
})

interface LandedHighlight {
  source: string
  lang: string
  highlight: CodeBlockHighlighter
  lines: string[]
}

/*
 * Plain lines until the highlighter answers. A synchronous highlighter
 * answers during setup, so server-rendered markup is already highlighted;
 * an async one fills in after. Only the latest call may land, and any
 * previous in-flight run is aborted when inputs change or the block unmounts.
 * While the next answer is on its way, lines that were highlighted before
 * and have not changed keep their colors.
 */
const landed = shallowRef<LandedHighlight | undefined>()
let run = 0
let activeController: AbortController | undefined

function abortActiveHighlight() {
  const controller = activeController
  activeController = undefined
  controller?.abort()
}

watch(
  [highlighter, () => split.value.source, () => props.lang],
  ([highlight, source, lang], _prev, onCleanup) => {
    const current = ++run
    abortActiveHighlight()
    if (!highlight || !source) {
      landed.value = undefined
      return
    }
    const last = landed.value
    if (last && last.highlight === highlight && last.lang === lang && last.source === source) {
      return
    }
    const controller = new AbortController()
    activeController = controller
    onCleanup(() => {
      if (activeController === controller) activeController = undefined
      controller.abort()
    })
    const apply = (html: string) => {
      if (current !== run || controller.signal.aborted) return
      landed.value = { source, lang, highlight, lines: htmlLines(html) }
    }
    try {
      const result = highlight(source, lang, { signal: controller.signal })
      if (typeof result === 'string') {
        apply(result)
      } else if (result && typeof result.then === 'function') {
        void result.then(apply, () => {})
      }
    } catch {
      // a highlighter that throws leaves the plain text
    }
  },
  { immediate: true },
)

const lines = computed<string[]>(() => {
  const { source, tail } = split.value
  const after = tail ? plainLines(tail) : []
  const highlight = highlighter.value
  if (!highlight || !source) return plainLines(code.value)
  const last = landed.value
  if (last && last.highlight === highlight && last.lang === props.lang) {
    if (last.source === source) return after.length ? [...last.lines, ...after] : last.lines
    if (source.startsWith(`${last.source}\n`)) {
      return [...last.lines, ...plainLines(source.slice(last.source.length + 1)), ...after]
    }
  }
  return [...plainLines(source), ...after]
})

const marked = computed(() => parseLines(props.highlightLines))
const rows = computed(() =>
  lines.value.map((html, index) => {
    const number = props.startLine + index
    return { html, number, marked: marked.value.has(number) }
  }),
)

const expanded = ref(false)
const foldable = computed(() => props.maxLines !== undefined && rows.value.length > props.maxLines)
const folded = computed(() => foldable.value && !expanded.value)

const maxHeightValue = computed(() => {
  if (props.maxHeight === undefined || props.maxHeight === '') return undefined
  return typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight
})
const scrollable = computed(() => maxHeightValue.value !== undefined)

const bodyRef = useTemplateRef<HTMLElement>('body')
const codeRef = useTemplateRef<HTMLElement>('codeEl')
const scrollbarWidth = ref(0)

function syncScrollbarWidth() {
  const el = bodyRef.value
  if (!el || !scrollable.value || folded.value) {
    scrollbarWidth.value = 0
    return
  }
  scrollbarWidth.value = Math.max(0, el.offsetWidth - el.clientWidth)
}

const AT_BOTTOM_THRESHOLD = 24
const shouldAutoScroll = computed(() => props.autoScroll ?? props.streaming)
const atBottom = ref(true)
watch(atBottom, (value) => emit('atBottomChange', value))

// Following is a choice of the reader: scrolling up pauses it, and reaching
// the bottom resumes it. Appending content alone never turns it off.
let following = true
let scrollingToBottom = false
let lastScrollTop = 0

function distanceToBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

function isNearBottom(el: HTMLElement) {
  return distanceToBottom(el) <= AT_BOTTOM_THRESHOLD
}

function onBodyScroll() {
  const el = bodyRef.value
  if (!el) return
  const distance = distanceToBottom(el)
  const near = distance <= AT_BOTTOM_THRESHOLD
  if (el.scrollTop < lastScrollTop && distance > 1) {
    scrollingToBottom = false
    following = false
  } else if (near) {
    following = true
    scrollingToBottom = false
  } else if (scrollingToBottom && el.scrollTop >= lastScrollTop) {
    following = true
  } else if (el.scrollTop !== lastScrollTop) {
    scrollingToBottom = false
    following = false
  }
  lastScrollTop = el.scrollTop
  atBottom.value = near
}

function onBodyWheel(event: WheelEvent) {
  const el = bodyRef.value
  if (event.deltaY < 0 && el && el.scrollHeight > el.clientHeight) {
    following = false
    scrollingToBottom = false
  }
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  const el = bodyRef.value
  if (!el) return
  following = true
  const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
  if (behavior === 'smooth' && typeof el.scrollTo === 'function') {
    el.scrollTo({ top: el.scrollHeight, behavior })
    const near = isNearBottom(el)
    scrollingToBottom = !near
    lastScrollTop = el.scrollTop
    atBottom.value = near
  } else {
    scrollingToBottom = false
    el.scrollTop = maxTop
    lastScrollTop = el.scrollTop
    atBottom.value = true
  }
}

function follow() {
  syncScrollbarWidth()
  const el = bodyRef.value
  if (!el) return
  if (!shouldAutoScroll.value || !following || folded.value) {
    atBottom.value = isNearBottom(el)
    return
  }
  scrollingToBottom = false
  el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
  lastScrollTop = el.scrollTop
  atBottom.value = true
}

let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  follow()
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(follow)
  if (bodyRef.value) resizeObserver.observe(bodyRef.value)
  if (codeRef.value) resizeObserver.observe(codeRef.value)
})
onBeforeUnmount(() => {
  abortActiveHighlight()
  resizeObserver?.disconnect()
})

watch(
  [() => props.code, lines, maxHeightValue, () => props.wrap, folded, shouldAutoScroll],
  follow,
  { flush: 'post' },
)

const title = computed(() => props.filename ?? (props.lang === 'text' ? '' : props.lang))
const hasHeader = computed(() => !!(slots.title || title.value || slots.actions))

const classes = computed(() => [
  ns.b(),
  ns.is('wrap', props.wrap),
  ns.is('numbered', props.lineNumbers),
  ns.is('folded', folded.value),
  ns.is('scrollable', scrollable.value),
  ns.is('headless', !hasHeader.value),
  ns.is('streaming', props.streaming),
  ns.is('bordered', props.bordered),
])

const rootStyle = computed(() => {
  const style: Record<string, string | number> = {}
  if (foldable.value && props.maxLines !== undefined) {
    style['--dou-code-block-max-lines'] = props.maxLines
  }
  if (maxHeightValue.value !== undefined) {
    style['--dou-code-block-max-height'] = maxHeightValue.value
  }
  if (scrollbarWidth.value > 0) {
    style['--dou-code-block-scrollbar-width'] = `${scrollbarWidth.value}px`
  }
  return Object.keys(style).length ? style : undefined
})

defineExpose<CodeBlockExpose>({
  get body() {
    return bodyRef.value
  },
  scrollToBottom,
  get atBottom() {
    return atBottom.value
  },
})
</script>

<template>
  <div :class="classes" :style="rootStyle">
    <div v-if="hasHeader" :class="ns.e('header')">
      <span :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </span>
      <span :class="ns.e('actions')">
        <slot name="actions" />
        <DouCopyButton v-if="copyable" :text="code" size="sm" />
      </span>
    </div>
    <DouCopyButton v-else-if="copyable" :class="ns.e('copy')" :text="code" size="sm" />
    <div
      :id="bodyId"
      ref="body"
      :class="ns.e('body')"
      :data-lang="lang"
      :tabindex="scrollable && !folded ? 0 : undefined"
      @scroll.passive="onBodyScroll"
      @wheel.passive="onBodyWheel"
    >
      <code ref="codeEl" :class="ns.e('code')">
        <span
          v-for="row in rows"
          :key="row.number"
          :class="[ns.e('row'), ns.is('marked', row.marked)]"
        >
          <span v-if="lineNumbers" :class="ns.e('number')" aria-hidden="true">{{
            row.number
          }}</span>
          <span :class="ns.e('line')" v-html="row.html" />
        </span>
      </code>
    </div>
    <button
      v-if="foldable"
      type="button"
      :class="ns.e('toggle')"
      :aria-expanded="expanded"
      :aria-controls="bodyId"
      @click="expanded = !expanded"
    >
      {{ expanded ? t('codeBlock.collapse') : t('codeBlock.expand', { count: rows.length }) }}
    </button>
  </div>
</template>
