<script setup lang="ts">
import { ArrowUpRightIcon } from '@dou-ui/icons'
import {
  Comment,
  Fragment,
  Text,
  computed,
  createTextVNode,
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
// space, which would show inside a soft fill or under the underline. Slots
// passed on by a wrapper come as fragments, and a `v-if` leaves a comment:
// look through both for the first and last text.
type Trim = 'trimStart' | 'trimEnd'
function trimEdge(nodes: unknown[], how: Trim): unknown[] {
  const out = [...nodes]
  const order = how === 'trimStart' ? out.keys() : [...out.keys()].reverse()
  for (const index of order) {
    const node = out[index]
    if (!isVNode(node)) {
      if (typeof node === 'string') {
        out[index] = node[how]()
        if (out[index]) return out
      }
      continue
    }
    if (node.type === Comment) continue
    if (node.type === Text && typeof node.children === 'string') {
      const text = node.children[how]()
      out[index] = createTextVNode(text)
      if (text) return out
      continue
    }
    if (node.type === Fragment && Array.isArray(node.children)) {
      out[index] = { ...node, children: trimEdge(node.children, how) } as VNode
      return out
    }
    return out
  }
  return out
}
function trimmed(nodes: VNode[] | undefined) {
  if (!nodes?.length) return nodes
  return trimEdge(trimEdge(nodes, 'trimStart'), 'trimEnd') as VNode[]
}
const WJ = '\u2060'
const Label = () => trimmed(slots.default?.() as VNode[] | undefined)

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
    <span v-if="slots.leading" :class="ns.e('icon')">
      <slot name="leading" />
    </span>
    <!-- a soft link breaks with the line: a word joiner keeps each icon on
         the line of the word beside it -->
    <template v-if="slots.leading && variant === 'soft'">{{ WJ }}</template>
    <span :class="ns.e('label')"><Label /></span>
    <template v-if="(slots.trailing || (external && !isButton)) && variant === 'soft'">{{
      WJ
    }}</template>
    <span v-if="slots.trailing" :class="ns.e('icon')">
      <slot name="trailing" />
    </span>
    <span
      v-else-if="external && !isButton"
      :class="[ns.e('icon'), ns.e('external')]"
      aria-hidden="true"
    >
      <ArrowUpRightIcon />
    </span>
  </component>
</template>
