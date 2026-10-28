<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { IconProps, IconSlots } from './icon'

defineOptions({ name: 'DouIcon' })

const props = withDefaults(defineProps<IconProps>(), {
  spin: false,
})
defineSlots<IconSlots>()

const ns = useNamespace('icon')

const style = computed(() => {
  if (props.size === undefined) return undefined
  const size = typeof props.size === 'number' ? `${props.size}px` : props.size
  return { '--dou-icon-size': size }
})
</script>

<template>
  <span
    :class="[ns.b(), ns.is('spin', spin)]"
    :style="style"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <slot />
  </span>
</template>
