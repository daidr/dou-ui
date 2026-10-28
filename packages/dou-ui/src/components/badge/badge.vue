<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { BadgeProps, BadgeSlots } from './badge'

defineOptions({ name: 'DouBadge' })

const props = withDefaults(defineProps<BadgeProps>(), {
  max: 99,
  dot: false,
  tone: 'neutral',
  showZero: false,
  hidden: false,
  placement: 'top-end',
})
const slots = defineSlots<BadgeSlots>()

const ns = useNamespace('badge')

const text = computed(() => {
  const { value, max } = props
  if (typeof value === 'number') return value > max ? `${max}+` : String(value)
  return value ?? ''
})

const visible = computed(() => {
  if (props.hidden) return false
  if (props.dot || slots.content) return true
  if (props.value === 0) return props.showZero
  return text.value !== ''
})

const classes = computed(() => [
  ns.e('mark'),
  ns.m(props.tone),
  ns.is('dot', props.dot),
  ns.is('standalone', !slots.default),
])
</script>

<template>
  <span v-if="slots.default" :class="[ns.b(), ns.m(placement)]">
    <slot />
    <sup
      v-if="visible"
      :class="classes"
      :aria-label="label"
      :aria-hidden="dot && !label ? 'true' : undefined"
    >
      <template v-if="!dot">
        <span :class="ns.e('text')"
          ><slot name="content">{{ text }}</slot></span
        >
      </template>
    </sup>
  </span>
  <span
    v-else-if="visible"
    :class="classes"
    :aria-label="label"
    :aria-hidden="dot && !label ? 'true' : undefined"
  >
    <template v-if="!dot">
      <span :class="ns.e('text')"
        ><slot name="content">{{ text }}</slot></span
      >
    </template>
  </span>
</template>
