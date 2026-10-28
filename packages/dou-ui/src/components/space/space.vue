<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { SpaceProps, SpaceSlots } from './space'

defineOptions({ name: 'DouSpace' })

const props = withDefaults(defineProps<SpaceProps>(), {
  direction: 'horizontal',
  size: 'md',
  wrap: false,
  block: false,
})
defineSlots<SpaceSlots>()

const ns = useNamespace('space')

const scale = ['sm', 'md', 'lg']
const step = computed(() =>
  typeof props.size === 'string' && scale.includes(props.size) ? props.size : undefined,
)

const align = computed(
  () => props.align ?? (props.direction === 'horizontal' ? 'center' : 'stretch'),
)

const classes = computed(() => [
  ns.b(),
  ns.m(props.direction),
  step.value && ns.m(step.value),
  ns.m(`align-${align.value}`),
  props.justify && ns.m(`justify-${props.justify}`),
  ns.is('wrap', props.wrap),
  ns.is('block', props.block),
])

const style = computed(() => {
  if (step.value) return undefined
  const gap = typeof props.size === 'number' ? `${props.size}px` : props.size
  return { '--dou-space-gap': gap }
})
</script>

<template>
  <div :class="classes" :style="style">
    <slot />
  </div>
</template>
