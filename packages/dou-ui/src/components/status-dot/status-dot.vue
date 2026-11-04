<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { StatusDotProps, StatusDotSlots } from './status-dot'

defineOptions({ name: 'DouStatusDot' })

const props = withDefaults(defineProps<StatusDotProps>(), {
  tone: 'neutral',
  size: 'md',
  ripple: false,
})
const slots = defineSlots<StatusDotSlots>()

const ns = useNamespace('status-dot')
// With text beside it the text speaks for the dot; a bare dot speaks through its label.
const bare = computed(() => !slots.default)
</script>

<template>
  <span
    :class="[ns.b(), ns.m(tone), ns.m(size), ns.is('ripple', ripple)]"
    :role="bare && label ? 'img' : undefined"
    :aria-label="bare ? label : undefined"
    :aria-hidden="bare && !label ? 'true' : undefined"
    ><span :class="ns.e('dot')" aria-hidden="true" /><span
      v-if="slots.default"
      :class="ns.e('label')"
      ><slot /></span
  ></span>
</template>
