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
import { devWarn } from '../../utils/status-check'
import type { LinkEmits, LinkProps, LinkSlots } from './link'

defineOptions({ name: 'DouLink' })

const props = withDefaults(defineProps<LinkProps>(), {
  tone: 'neutral',
  variant: 'text',
  underline: undefined,
  disabled: false,
  external: false,
})
const emit = defineEmits<LinkEmits>()
const slots = defineSlots<LinkSlots>()

const ns = useNamespace('link')

// Without an address there is nowhere to go: the link is an action, so it is
// a button, which takes focus and responds to Enter and Space.
const isButton = computed(() => !props.href)

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
    ? [chars.slice(1).join(''), chars[0]]
    : [chars.slice(0, -1).join(''), chars[chars.length - 1]]
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
const Content = () => {
  const label = (slots.default?.() ?? []) as unknown[]
  const soft = props.variant === 'soft'
  const leading = slots.leading?.()
  const trailing = slots.trailing
    ? slots.trailing()
    : props.external && !isButton.value
      ? h(ArrowUpRightIcon)
      : undefined
  const head = walk(label, 'start', soft && !!leading)
  const tail = walk(head.nodes, 'end', soft && !!trailing)
  const icon = (content: unknown, external = false) =>
    h(
      'span',
      {
        class: [ns.e('icon'), external && ns.e('external')],
        'aria-hidden': external ? 'true' : undefined,
      },
      content as VNode[],
    )
  const external = !slots.trailing
  const before = leading && icon(leading)
  const after = trailing && icon(trailing, external)
  const body = h('span', { class: ns.e('label') }, tail.nodes as VNode[])
  if (!soft) return [before, body, after]
  return [
    before && h('span', { class: ns.e('lead') }, [before, head.char]),
    body,
    after && h('span', { class: ns.e('trail') }, [tail.char, after]),
  ]
}

const classes = computed(() => [
  ns.b(),
  ns.m(props.tone),
  ns.m(props.variant),
  ns.m(`underline-${props.underline ?? (props.variant === 'soft' ? 'none' : 'always')}`),
  ns.is('disabled', props.disabled),
])

const attrs = computed(() =>
  isButton.value
    ? { type: 'button', disabled: props.disabled }
    : {
        href: props.disabled ? undefined : props.href,
        target: props.external ? '_blank' : undefined,
        rel: props.external ? 'noopener noreferrer' : undefined,
        'aria-disabled': props.disabled || undefined,
      },
)

function onClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <component
    :is="isButton ? 'button' : 'a'"
    ref="root"
    :class="classes"
    v-bind="attrs"
    @click="onClick"
  >
    <Content />
  </component>
</template>
