<script setup lang="ts">
import { computed, provide, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { radioGroupKey } from './radio'
import type { RadioGroupProps, RadioGroupSlots, RadioValue } from './radio'

defineOptions({ name: 'DouRadioGroup' })

const props = withDefaults(defineProps<RadioGroupProps>(), {
  disabled: false,
  direction: 'horizontal',
})
// An explicit default stops Vue from reading a missing value as `false`.
const model = defineModel<RadioValue | undefined>({ default: undefined })
defineSlots<RadioGroupSlots>()

const ns = useNamespace('radio-group')

// Options must share a name so the browser handles arrow keys and
// keeps a single option checked.
const id = useId()
const name = computed(() => props.name ?? `dou-radio-${id}`)

const { formItem } = useFormItem()
formItem?.markGroup()
const disabled = useFormDisabled(() => props.disabled)

provide(radioGroupKey, {
  model,
  disabled,
  size: useFormSize(() => props.size),
  name,
  select(value) {
    model.value = value
    formItem?.trigger('change')
  },
})

const classes = computed(() => [ns.b(), ns.m(props.direction)])
</script>

<template>
  <div
    :id="formItem?.inputId"
    :class="classes"
    role="radiogroup"
    :aria-disabled="disabled || undefined"
    :aria-labelledby="formItem?.labelId"
    :aria-describedby="formItem?.describedBy.value"
    :aria-invalid="formItem?.invalid.value || undefined"
    :aria-required="formItem?.required.value || undefined"
  >
    <slot />
  </div>
</template>
