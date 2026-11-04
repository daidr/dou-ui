<script setup lang="ts">
import { computed, ref, shallowRef, useId, watchEffect } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useGlobalConfig, useLocale } from '../config-provider/use-config'
import { DouCopyButton } from '../copy-button'
import type { CodeBlockHighlighter, CodeBlockProps, CodeBlockSlots } from './code-block'
import { htmlLines, parseLines, plainLines } from './lines'

defineOptions({ name: 'DouCodeBlock' })

const props = withDefaults(defineProps<CodeBlockProps>(), {
  code: '',
  lang: 'text',
  lineNumbers: false,
  startLine: 1,
  wrap: false,
  copyable: true,
  streaming: false,
  bordered: true,
})
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

/*
 * Plain lines until the highlighter answers. A synchronous highlighter
 * answers during setup, so server-rendered markup is already highlighted;
 * an async one fills in after. Only the latest call may land. While the
 * next answer is on its way, lines that were highlighted before and have
 * not changed keep their colors.
 */
const lines = shallowRef<string[]>(plainLines(code.value))
let run = 0
// what the last answer covered, and its lines
let landed: { source: string; lines: string[] } | undefined
watchEffect(() => {
  const current = ++run
  const highlight = highlighter.value
  const raw = props.code
  // while streaming, the line still being written stays plain
  const cut = props.streaming ? raw.lastIndexOf('\n') + 1 : raw.length
  const source = raw.slice(0, cut).replace(/\n$/, '')
  const tail = props.streaming ? raw.slice(cut) : ''
  const after = tail ? plainLines(tail) : []
  if (!highlight || !source) {
    lines.value = plainLines(code.value)
    return
  }
  if (landed?.source === source) {
    lines.value = after.length ? [...landed.lines, ...after] : landed.lines
    return
  }
  const kept = landed && source.startsWith(`${landed.source}\n`) ? landed : undefined
  lines.value = kept
    ? [...kept.lines, ...plainLines(source.slice(kept.source.length + 1)), ...after]
    : [...plainLines(source), ...after]
  const apply = (html: string) => {
    if (current !== run) return
    landed = { source, lines: htmlLines(html) }
    lines.value = after.length ? [...landed.lines, ...after] : landed.lines
  }
  try {
    const result = highlight(source, props.lang)
    if (typeof result === 'string') apply(result)
    else void result.then(apply, () => {})
  } catch {
    // a highlighter that throws leaves the plain text
  }
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

const title = computed(() => props.filename ?? (props.lang === 'text' ? '' : props.lang))
const hasHeader = computed(() => !!(slots.title || title.value || slots.actions))

const classes = computed(() => [
  ns.b(),
  ns.is('wrap', props.wrap),
  ns.is('numbered', props.lineNumbers),
  ns.is('folded', folded.value),
  ns.is('headless', !hasHeader.value),
  ns.is('streaming', props.streaming),
  ns.is('bordered', props.bordered),
])
</script>

<template>
  <div :class="classes" :style="foldable ? { '--dou-code-block-max-lines': maxLines } : undefined">
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
    <div :id="bodyId" :class="ns.e('body')" :data-lang="lang">
      <code :class="ns.e('code')">
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
