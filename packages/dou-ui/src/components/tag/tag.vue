<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { TagEmits, TagProps, TagSlots } from './tag'

defineOptions({ name: 'DouTag' })

const props = withDefaults(defineProps<TagProps>(), {
  variant: 'soft',
  tone: 'neutral',
  size: 'md',
  closable: false,
  round: false,
})
const emit = defineEmits<TagEmits>()
const slots = defineSlots<TagSlots>()

const ns = useNamespace('tag')

const classes = computed(() => [
  ns.b(),
  ns.m(props.variant),
  ns.m(props.tone),
  ns.m(props.size),
  ns.is('round', props.round),
])
</script>

<template>
  <span :class="classes">
    <span v-if="slots.leading" :class="ns.e('icon')">
      <slot name="leading" />
    </span>
    <span :class="ns.e('label')"><slot /></span>
    <button
      v-if="closable"
      type="button"
      :class="ns.e('close')"
      aria-label="移除"
      @click="emit('close', $event)"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke-linecap="round" />
      </svg>
    </button>
  </span>
</template>
