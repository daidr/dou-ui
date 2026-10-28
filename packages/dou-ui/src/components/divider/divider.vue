<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { DividerProps, DividerSlots } from './divider'

defineOptions({ name: 'DouDivider' })

const props = withDefaults(defineProps<DividerProps>(), {
  direction: 'horizontal',
  align: 'center',
  dashed: false,
})
const slots = defineSlots<DividerSlots>()

const ns = useNamespace('divider')

const labelled = computed(() => props.direction === 'horizontal' && !!slots.default)

const classes = computed(() => [
  ns.b(),
  ns.m(props.direction),
  labelled.value && ns.m(props.align),
  ns.is('labelled', labelled.value),
  ns.is('dashed', props.dashed),
])
</script>

<template>
  <div :class="classes" role="separator" :aria-orientation="direction">
    <span v-if="labelled" :class="ns.e('label')"><slot /></span>
  </div>
</template>
