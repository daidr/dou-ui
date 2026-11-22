<script setup lang="ts">
import { ArrowUpRightIcon } from '@dou-ui/icons'
import {
  Comment,
  Fragment,
  Text,
  computed,
  createTextVNode,
  h,
  isVNode,
  onMounted,
  useTemplateRef,
  watchEffect,
} from 'vue'
import type { VNode } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { filled } from '../../utils/slot'
import { devWarn } from '../../utils/status-check'
import type { LinkEmits, LinkProps, LinkSlots } from './link'

defineOptions({ name: 'DouLink' })

const props = withDefaults(defineProps<LinkProps>(), {
  tone: 'neutral',
  variant: 'text',
  wrap: false,
  underline: undefined,
  disabled: false,
  external: false,
})
const emit = defineEmits<LinkEmits>()
const slots = defineSlots<LinkSlots>()

const ns = useNamespace('link')

// Without an address there is nowhere to go: the link is an action. When it
// needs to break across lines (`soft` or `wrap`), it cannot be a `<button>`
// (an atomic inline box that never fragments across lines), so it renders as
// an inline `<span role="button">` with keyboard Enter/Space support.
const isButton = computed(() => !props.href)
const wraps = computed(() => props.variant === 'soft' || props.wrap)
const isInlineButton = computed(() => isButton.value && wraps.value)

if (process.env.NODE_ENV !== 'production')
  watchEffect(() => {
    if (props.external && !props.href)
      devWarn(
        '[dou-ui] DouLink: `external` opens `href` in a new tab; without an `href` the link is a button and `external` does nothing.',
      )
  })

// A button inside a button is invalid: the parser splits them apart and
// server-rendered markup no longer matches on hydration.
const root = useTemplateRef<HTMLElement>('root')
if (process.env.NODE_ENV !== 'production')
  onMounted(() => {
    if (isButton.value && root.value?.parentElement?.closest('button'))
      devWarn(
        '[dou-ui] DouLink: without an `href` the link is a button, and it sits inside another button. Pass an `href`, or move it out of the clickable element.',
      )
  })

// A label written on its own lines in a template starts and ends with a
// space, which would show under the underline or inside a soft fill. Slots
// passed on by a wrapper come as fragments, and a `v-if` leaves a comment:
// look through both for the first and last text. A fragment that holds
// nothing but spaces is passed over for the next node.
//
// A soft link breaks with the line, and an icon must not be left alone at
// the end of one: the first and last characters of the label are taken out
// to sit beside the icons in a span that never breaks. A character inside
// an element of its own (`<strong>`) stays where it is.
type Edge = 'start' | 'end'
type Walk = { nodes: unknown[]; done: boolean; char: string }
function cut(text: string, edge: Edge, take: boolean): [rest: string, char: string] {
  const trimmed = edge === 'start' ? text.trimStart() : text.trimEnd()
  if (!take || !trimmed) return [trimmed, '']
  const chars = Array.from(trimmed)
  return edge === 'start'
    ? [chars.slice(1).join(''), chars[0] ?? '']
    : [chars.slice(0, -1).join(''), chars[chars.length - 1] ?? '']
}
function walk(nodes: unknown[], edge: Edge, take: boolean): Walk {
  const out = [...nodes]
  const step = edge === 'start' ? 1 : -1
  for (let index = step > 0 ? 0 : out.length - 1; index >= 0 && index < out.length; index += step) {
    const node = out[index]
    if (typeof node === 'string' || (isVNode(node) && node.type === Text)) {
      const text = typeof node === 'string' ? node : node.children
      if (typeof text !== 'string') return { nodes: out, done: true, char: '' }
      const [rest, char] = cut(text, edge, take)
      out[index] = typeof node === 'string' ? rest : createTextVNode(rest)
      if (char || rest) return { nodes: out, done: true, char }
      continue
    }
    if (!isVNode(node) || node.type === Comment) continue
    if (node.type === Fragment && Array.isArray(node.children)) {
      const inner = walk(node.children, edge, take)
      out[index] = { ...node, children: inner.nodes } as VNode
      if (inner.done) return { ...inner, nodes: out }
      continue
    }
    return { nodes: out, done: true, char: '' }
  }
  return { nodes: out, done: false, char: '' }
}
// Called in this component's own render, so it follows slots that come
// and go; `Nodes` only puts the result down.
const parts = () => {
  const label = (slots.default?.() ?? []) as unknown[]
  const inlineFlow = wraps.value
  // a slot that renders nothing counts as not passed: no empty icon, and
  // an external link keeps its arrow
  const leading = filled(slots.leading)
  const own = filled(slots.trailing)
  const arrow = !own
  const trailing = own ?? (props.external && !isButton.value ? h(ArrowUpRightIcon) : undefined)
  const head = walk(label, 'start', inlineFlow && !!leading)
  const tail = walk(head.nodes, 'end', inlineFlow && !!trailing)
  const icon = (content: unknown, external = false) =>
    h(
      'span',
      {
        class: [ns.e('icon'), external && ns.e('external')],
        'aria-hidden': external ? 'true' : undefined,
      },
      content as VNode[],
    )
  const before = leading ? icon(leading) : undefined
  const after = trailing ? icon(trailing, arrow) : undefined
  const body = h('span', { class: ns.e('label') }, tail.nodes as VNode[])
  if (!inlineFlow) return [before, body, after]
  // a single character between two icons: all three break as one
  if (before && after && head.char && !tail.char)
    return [h('span', { class: [ns.e('lead'), ns.e('trail')] }, [before, head.char, body, after])]
  return [
    before && h('span', { class: ns.e('lead') }, [before, head.char]),
    body,
    after && h('span', { class: ns.e('trail') }, [tail.char, after]),
  ]
}
const Nodes = (nodes: { nodes: unknown }) => nodes.nodes as VNode[]

const classes = computed(() => [
  ns.b(),
  ns.m(props.tone),
  ns.m(props.variant),
  ns.m(`underline-${props.underline ?? (props.variant === 'soft' ? 'none' : 'always')}`),
  ns.is('wrap', props.wrap),
  ns.is('disabled', props.disabled),
])

const attrs = computed(() => {
  if (!isButton.value) {
    return {
      href: props.disabled ? undefined : props.href,
      target: props.external ? '_blank' : undefined,
      rel: props.external ? 'noopener noreferrer' : undefined,
      'aria-disabled': props.disabled || undefined,
    }
  }
  if (isInlineButton.value) {
    return {
      role: 'button',
      tabindex: props.disabled ? undefined : 0,
      'aria-disabled': props.disabled || undefined,
    }
  }
  return { type: 'button', disabled: props.disabled }
})

let spacePressed = false

function onClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  // A <span> inside a <label> (such as DouCheckbox) would otherwise toggle the
  // labeled control on click; a native <button> does not.
  if (isInlineButton.value) event.preventDefault()
  emit('click', event)
}

function onKeydown(event: KeyboardEvent) {
  if (!isInlineButton.value || props.disabled || event.defaultPrevented) return
  if (event.target !== event.currentTarget) return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key === 'Enter') {
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).click()
  } else if (event.key === ' ' || event.key === 'Spacebar') {
    // Prevent page scroll on Space down and activate on keyup, matching native buttons.
    event.preventDefault()
    spacePressed = true
  } else if (event.key === 'Escape') {
    spacePressed = false
  }
}

function onKeyup(event: KeyboardEvent) {
  if (!isInlineButton.value || !spacePressed) return
  if (event.key !== ' ' && event.key !== 'Spacebar') return
  spacePressed = false
  if (props.disabled || event.defaultPrevented || event.target !== event.currentTarget) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).click()
}

function onBlur() {
  spacePressed = false
}
</script>

<template>
  <component
    :is="isButton ? (isInlineButton ? 'span' : 'button') : 'a'"
    ref="root"
    :class="classes"
    v-bind="attrs"
    @click="onClick"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @blur="onBlur"
  >
    <Nodes :nodes="parts()" />
  </component>
</template>
