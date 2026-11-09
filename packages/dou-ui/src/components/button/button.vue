<script setup lang="ts">
import { Comment, Fragment, Text, computed, isVNode } from 'vue'
import type { VNode } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { SlotNodes, filled } from '../../utils/slot'
import { useFormDisabled, useFormSize } from '../form/use-form-item'
import type { ButtonEmits, ButtonProps, ButtonSlots } from './button'

defineOptions({ name: 'DouButton' })

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'solid',
  tone: 'neutral',
  disabled: false,
  loading: false,
  block: false,
  nativeType: 'button',
})
const emit = defineEmits<ButtonEmits>()
const slots = defineSlots<ButtonSlots>()

const ns = useNamespace('button')

// xs exists only on buttons, so a form or field group never sets it
const formSize = useFormSize(() => (props.size === 'xs' ? undefined : props.size))
const size = computed(() => (props.size === 'xs' ? 'xs' : formSize.value))
const disabled = useFormDisabled(() => props.disabled)
const inert = computed(() => disabled.value || props.loading)

const classes = computed(() => [
  ns.b(),
  ns.m(props.variant),
  ns.m(props.tone),
  ns.m(size.value),
  ns.is('loading', props.loading),
  ns.is('block', props.block),
])

// An icon passed as the only content of the default slot goes where the
// leading icon would, so it is centered and the button turns square.
// Components and svg/img count as icons; anything with text does not.
function hasText(nodes: unknown): boolean {
  return (Array.isArray(nodes) ? nodes : [nodes]).some((node) => {
    if (!isVNode(node)) return typeof node === 'string' && node.trim() !== ''
    if (node.type === Comment) return false
    if (node.type === Text) return String(node.children).trim() !== ''
    if (
      node.type === Fragment ||
      (typeof node.type === 'string' && !['svg', 'img'].includes(node.type))
    )
      return hasText(node.children)
    return false
  })
}

interface Layout {
  leading?: VNode[]
  label?: VNode[]
  trailing?: VNode[]
  /** The default slot holds only an icon, so it is sized and centered like one. */
  iconLabel: boolean
  iconOnly: boolean
}

// Each slot is rendered once a render, on the root's class binding, which is
// evaluated before the content below it; the content puts down what was
// rendered. A slot that renders nothing, e.g. a count behind a false `v-if`
// next to a leading icon, counts as not passed.
const layout: Layout = { iconLabel: false, iconOnly: false }
function measure() {
  const leading = filled(slots.leading)
  const label = filled(slots.default)
  const trailing = filled(slots.trailing)
  const iconLabel = !!label && !hasText(label)
  let iconOnly = false
  if (!trailing) iconOnly = label ? !leading && iconLabel : !!(leading || props.loading)
  Object.assign(layout, { leading, label, trailing, iconLabel, iconOnly })
  return iconOnly
}

function onClick(event: MouseEvent) {
  if (inert.value) return
  emit('click', event)
}
</script>

<template>
  <button
    :class="[classes, ns.is('icon-only', measure())]"
    :type="nativeType"
    :disabled="disabled"
    :aria-disabled="loading || undefined"
    :aria-busy="loading || undefined"
    @click="onClick"
  >
    <span v-if="loading" :class="ns.e('icon')" aria-hidden="true">
      <span :class="ns.e('spinner')" />
    </span>
    <span v-else-if="layout.leading" :class="ns.e('icon')">
      <SlotNodes :nodes="layout.leading" />
    </span>
    <template v-if="layout.label">
      <span v-if="!layout.iconLabel" :class="ns.e('label')"
        ><SlotNodes :nodes="layout.label"
      /></span>
      <span v-else-if="!loading" :class="ns.e('icon')"><SlotNodes :nodes="layout.label" /></span>
    </template>
    <span v-if="layout.trailing" :class="ns.e('icon')">
      <SlotNodes :nodes="layout.trailing" />
    </span>
  </button>
</template>
