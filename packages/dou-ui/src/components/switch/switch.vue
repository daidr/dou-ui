<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import type { SwitchProps, SwitchSlots } from './switch'

defineOptions({ name: 'DouSwitch', inheritAttrs: false })

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

// `class` and `style` dress the control; every other attribute (id,
// aria-*, data-*, listeners...) belongs to the native element.
const attrs = useAttrs()
const nativeAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('checked', model.value),
  ns.is('disabled', disabled.value),
  ns.is('loading', props.loading),
])
</script>

<template>
  <span :class="[classes, attrs.class]" :style="attrs.style as StyleValue">
    <button
      type="button"
      role="switch"
      :id="formItem?.inputId"
      :class="ns.e('track')"
      :aria-checked="model"
      :aria-busy="loading || undefined"
      :aria-labelledby="slots.default ? labelId : undefined"
      :aria-label="slots.default ? undefined : ariaLabel"
      :aria-describedby="formItem?.describedBy.value"
      :aria-invalid="formItem?.invalid.value || undefined"
      :disabled="disabled"
      @click="toggle"
      v-bind="nativeAttrs"
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
