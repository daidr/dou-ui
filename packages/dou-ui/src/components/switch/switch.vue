<script setup lang="ts">
import { computed, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import type { SwitchProps, SwitchSlots } from './switch'

defineOptions({ name: 'DouSwitch' })

const props = withDefaults(defineProps<SwitchProps>(), {
  disabled: false,
  loading: false,
})
const model = defineModel<boolean>({ default: false })
const slots = defineSlots<SwitchSlots>()

const ns = useNamespace('switch')
const labelId = useId()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)

function toggle() {
  if (disabled.value || props.loading) return
  model.value = !model.value
  formItem?.trigger('change')
}

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('checked', model.value),
  ns.is('disabled', disabled.value),
  ns.is('loading', props.loading),
])
</script>

<template>
  <span :class="classes">
    <button
      type="button"
      role="switch"
      :id="formItem?.inputId"
      :class="ns.e('track')"
      :aria-checked="model"
      :aria-busy="loading || undefined"
      :aria-labelledby="slots.default ? labelId : undefined"
      :aria-describedby="formItem?.describedBy.value"
      :aria-invalid="formItem?.invalid.value || undefined"
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
