<script setup lang="ts">
import { computed, inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { toggleGroupKey } from './toggle'
import type { ToggleEmits, ToggleProps, ToggleSlots } from './toggle'

defineOptions({ name: 'DouToggle' })

const props = withDefaults(defineProps<ToggleProps>(), {
  pressed: false,
  disabled: false,
})
const emit = defineEmits<ToggleEmits>()
const slots = defineSlots<ToggleSlots>()

const ns = useNamespace('toggle')
const group = inject(toggleGroupKey, undefined)
const inGroup = computed(() => !!group && props.value !== undefined)

const pressed = computed(() => (inGroup.value ? group!.isPressed(props.value!) : props.pressed))
const variant = computed(() => props.variant ?? group?.variant.value ?? 'ghost')
const disabled = computed(() => props.disabled || !!group?.disabled.value)

function onClick() {
  if (disabled.value) return
  if (inGroup.value) group!.toggle(props.value!)
  else emit('update:pressed', !props.pressed)
}
</script>

<template>
  <DouButton
    :class="[ns.b(), ns.m(variant), ns.is('pressed', pressed)]"
    :variant="variant"
    :size="size ?? group?.size.value"
    :disabled="disabled"
    :aria-pressed="pressed"
    @click="onClick"
  >
    <template v-if="slots.leading" #leading><slot name="leading" /></template>
    <slot />
  </DouButton>
</template>
