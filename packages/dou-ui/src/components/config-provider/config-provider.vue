<script setup lang="ts">
import { useMotionMode } from '../../composables/use-motion'
import { provideGlobalConfig } from './use-config'
import type { ConfigProviderProps, ConfigProviderSlots } from './config-provider'

defineOptions({ name: 'DouConfigProvider' })

const props = withDefaults(defineProps<ConfigProviderProps>(), { teleport: undefined })
defineSlots<ConfigProviderSlots>()

provideGlobalConfig(() => ({
  size: props.size,
  locale: props.locale,
  zIndex: props.zIndex,
  teleport: props.teleport,
  defaults: props.defaults,
  motion: props.motion,
}))
useMotionMode(() => props.motion)
</script>

<template>
  <slot />
</template>
