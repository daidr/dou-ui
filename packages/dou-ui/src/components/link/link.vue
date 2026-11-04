<script setup lang="ts">
import { ArrowUpRightIcon } from '@dou-ui/icons'
import { computed, onMounted, useTemplateRef, watchEffect } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { devWarn } from '../../utils/status-check'
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

const classes = computed(() => [
  ns.b(),
  ns.m(props.tone),
  ns.m(`underline-${props.underline}`),
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
    <span :class="ns.e('label')"><slot /></span>
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
