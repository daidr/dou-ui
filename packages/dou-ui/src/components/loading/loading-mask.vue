<script setup lang="ts">
import { useNamespace } from '../../utils/namespace'
import { DouSpinner } from '../spinner'
import type { SpinnerSize } from '../spinner/spinner'

defineOptions({ name: 'DouLoadingMask' })

defineProps<{
  text?: string
  size?: SpinnerSize
  fullscreen?: boolean
  zIndex?: number
  theme?: string
}>()

const ns = useNamespace('loading')
</script>

<template>
  <div
    :class="[ns.e('mask'), ns.is('fullscreen', fullscreen)]"
    :style="{ zIndex }"
    :data-dou-theme="theme"
  >
    <div :class="ns.e('content')">
      <DouSpinner :size="size ?? (fullscreen ? 'lg' : 'md')" :label="text" />
      <span v-if="text" :class="ns.e('text')" aria-hidden="true">{{ text }}</span>
    </div>
  </div>
</template>
