<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { LinkEmits, LinkProps, LinkSlots } from './link'

defineOptions({ name: 'DouLink' })

const props = withDefaults(defineProps<LinkProps>(), {
  tone: 'neutral',
  underline: 'always',
  disabled: false,
  external: false,
})
const emit = defineEmits<LinkEmits>()
const slots = defineSlots<LinkSlots>()

const ns = useNamespace('link')

const classes = computed(() => [
  ns.b(),
  ns.m(props.tone),
  ns.m(`underline-${props.underline}`),
  ns.is('disabled', props.disabled),
])

function onClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <a
    :class="classes"
    :href="disabled ? undefined : href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
    :aria-disabled="disabled || undefined"
    @click="onClick"
  >
    <span v-if="slots.leading" :class="ns.e('icon')">
      <slot name="leading" />
    </span>
    <span :class="ns.e('label')"><slot /></span>
    <span v-if="slots.trailing" :class="ns.e('icon')">
      <slot name="trailing" />
    </span>
    <span v-else-if="external" :class="[ns.e('icon'), ns.e('external')]" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5.5 4.5h6v6M11.5 4.5l-7 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  </a>
</template>
