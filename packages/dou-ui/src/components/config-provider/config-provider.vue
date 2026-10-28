<script setup lang="ts">
import { provideGlobalConfig } from './use-config'
import type { ConfigProviderProps, ConfigProviderSlots } from './config-provider'

defineOptions({ name: 'DouConfigProvider' })

const props = defineProps<ConfigProviderProps>()
defineSlots<ConfigProviderSlots>()

provideGlobalConfig(() => ({ size: props.size, locale: props.locale, zIndex: props.zIndex }))
</script>

<template>
  <slot />
</template>
