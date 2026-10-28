<script setup lang="ts">
import { computed, provide, toRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { checkboxGroupKey } from './checkbox'
import type { CheckboxGroupProps, CheckboxGroupSlots, CheckboxValue } from './checkbox'

defineOptions({ name: 'DouCheckboxGroup' })

const props = withDefaults(defineProps<CheckboxGroupProps>(), {
  disabled: false,
  direction: 'horizontal',
})
const model = defineModel<CheckboxValue[]>({ default: () => [] })
defineSlots<CheckboxGroupSlots>()

const ns = useNamespace('checkbox-group')
const { formItem } = useFormItem()
formItem?.markGroup()

provide(checkboxGroupKey, {
  model,
  disabled: useFormDisabled(() => props.disabled),
  size: useFormSize(() => props.size),
  name: toRef(props, 'name'),
  toggle(value, checked) {
    const rest = model.value.filter((item) => item !== value)
    model.value = checked ? [...rest, value] : rest
    formItem?.trigger('change')
  },
})

const classes = computed(() => [ns.b(), ns.m(props.direction)])
</script>

<template>
  <div
    :id="formItem?.inputId"
    :class="classes"
    role="group"
    :aria-labelledby="formItem?.labelId"
    :aria-describedby="formItem?.describedBy.value"
    :aria-invalid="formItem?.invalid.value || undefined"
  >
    <slot />
  </div>
</template>
