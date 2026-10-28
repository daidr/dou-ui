<script setup lang="ts">
import { useNamespace } from '../../utils/namespace'
import type { TimelineProps, TimelineSlots } from './timeline'

defineOptions({ name: 'DouTimeline' })

withDefaults(defineProps<TimelineProps>(), { reverse: false })
defineSlots<TimelineSlots>()

const ns = useNamespace('timeline')
</script>

<template>
  <ol :class="[ns.b(), ns.is('reverse', reverse)]">
    <slot />
  </ol>
</template>
