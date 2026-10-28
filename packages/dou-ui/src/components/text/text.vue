<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { TextProps, TextSlots } from './text'

defineOptions({ name: 'DouText' })

const props = withDefaults(defineProps<TextProps>(), {
  variant: 'default',
  tone: 'neutral',
  mono: false,
  truncate: false,
  as: 'span',
})
defineSlots<TextSlots>()

const ns = useNamespace('text')

const lines = computed(() => (typeof props.truncate === 'number' ? props.truncate : 0))

const classes = computed(() => [
  ns.b(),
  ns.m(props.variant),
  ns.m(props.tone),
  props.size && ns.m(props.size),
  props.weight && ns.m(props.weight),
  ns.is('mono', props.mono),
  ns.is('truncate', props.truncate === true || lines.value === 1),
  ns.is('clamp', lines.value > 1),
])

const style = computed(() => (lines.value > 1 ? { '--dou-text-lines': lines.value } : undefined))
</script>

<template>
  <component :is="as" :class="classes" :style="style">
    <slot />
  </component>
</template>
