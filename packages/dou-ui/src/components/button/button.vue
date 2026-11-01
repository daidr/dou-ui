<script setup lang="ts">
import { Comment, Fragment, Text, computed, isVNode } from 'vue'
import { useNamespace } from '../../utils/namespace'
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

const size = useFormSize(() => props.size)
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

// Read while rendering: slot content can change from one render to the next.
/** The default slot holds only an icon, so it is sized and centered like one. */
function iconLabel() {
  return !!slots.default && !hasText(slots.default())
}

function iconOnly() {
  if (slots.trailing) return false
  if (slots.default) return !slots.leading && iconLabel()
  return !!(slots.leading || props.loading)
}

function onClick(event: MouseEvent) {
  if (inert.value) return
  emit('click', event)
}
</script>

<template>
  <button
    :class="[classes, ns.is('icon-only', iconOnly())]"
    :type="nativeType"
    :disabled="disabled"
    :aria-disabled="loading || undefined"
    :aria-busy="loading || undefined"
    @click="onClick"
  >
    <span v-if="loading" :class="ns.e('icon')" aria-hidden="true">
      <span :class="ns.e('spinner')" />
    </span>
    <span v-else-if="slots.leading" :class="ns.e('icon')">
      <slot name="leading" />
    </span>
    <template v-if="slots.default">
      <span v-if="!iconLabel()" :class="ns.e('label')"><slot /></span>
      <span v-else-if="!loading" :class="ns.e('icon')"><slot /></span>
    </template>
    <span v-if="slots.trailing" :class="ns.e('icon')">
      <slot name="trailing" />
    </span>
  </button>
</template>
