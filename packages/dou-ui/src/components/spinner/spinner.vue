<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { SpinnerProps } from './spinner'

defineOptions({ name: 'DouSpinner' })

const props = withDefaults(defineProps<SpinnerProps>(), { size: 'md' })

const ns = useNamespace('spinner')
const { t } = useLocale()

const classes = computed(() => [ns.b(), typeof props.size === 'string' && ns.m(props.size)])
const style = computed(() =>
  typeof props.size === 'number' ? { '--dou-spinner-size': `${props.size}px` } : undefined,
)
</script>

<template>
  <span :class="classes" :style="style" role="status" :aria-label="label ?? t('spinner.loading')" />
</template>
