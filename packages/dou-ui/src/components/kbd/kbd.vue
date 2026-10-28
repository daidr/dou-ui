<script setup lang="ts">
import { useNamespace } from '../../utils/namespace'
import type { KbdProps, KbdSlots } from './kbd'

defineOptions({ name: 'DouKbd' })

withDefaults(defineProps<KbdProps>(), { size: 'md' })
defineSlots<KbdSlots>()

const ns = useNamespace('kbd')
</script>

<template>
  <kbd :class="[ns.b(), ns.m(size)]"
    ><span :class="ns.e('label')"><slot /></span
  ></kbd>
</template>
