<script setup lang="ts">
import { computed, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { SwitchProps, SwitchSlots } from './switch'

defineOptions({ name: 'DouSwitch' })

const props = withDefaults(defineProps<SwitchProps>(), {
  disabled: false,
  loading: false,
  size: 'md',
})
const model = defineModel<boolean>({ default: false })
const slots = defineSlots<SwitchSlots>()

const ns = useNamespace('switch')
const labelId = useId()

function toggle() {
  if (props.disabled || props.loading) return
  model.value = !model.value
}

const classes = computed(() => [
  ns.b(),
  ns.m(props.size),
  ns.is('checked', model.value),
  ns.is('disabled', props.disabled),
  ns.is('loading', props.loading),
])
</script>

<template>
  <span :class="classes">
    <button
      type="button"
      role="switch"
      :class="ns.e('track')"
      :aria-checked="model"
      :aria-busy="loading || undefined"
      :aria-labelledby="slots.default ? labelId : undefined"
      :disabled="disabled"
      @click="toggle"
    >
      <span :class="ns.e('thumb')">
        <span v-if="loading" :class="ns.e('spinner')" aria-hidden="true" />
      </span>
    </button>
    <span v-if="slots.default" :id="labelId" :class="ns.e('label')" @click="toggle">
      <slot />
    </span>
  </span>
</template>
