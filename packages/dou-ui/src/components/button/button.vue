<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { ButtonEmits, ButtonProps, ButtonSlots } from './button'

defineOptions({ name: 'DouButton' })

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'solid',
  tone: 'neutral',
  size: 'md',
  disabled: false,
  loading: false,
  block: false,
  nativeType: 'button',
})
const emit = defineEmits<ButtonEmits>()
const slots = defineSlots<ButtonSlots>()

const ns = useNamespace('button')

const inert = computed(() => props.disabled || props.loading)

const classes = computed(() => [
  ns.b(),
  ns.m(props.variant),
  ns.m(props.tone),
  ns.m(props.size),
  ns.is('loading', props.loading),
  ns.is('block', props.block),
])

function onClick(event: MouseEvent) {
  if (inert.value) return
  emit('click', event)
}
</script>

<template>
  <button
    :class="classes"
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
    <slot />
    <span v-if="slots.trailing" :class="ns.e('icon')">
      <slot name="trailing" />
    </span>
  </button>
</template>
