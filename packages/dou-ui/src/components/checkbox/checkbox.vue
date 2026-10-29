<script setup lang="ts">
import { CheckIcon, MinusIcon } from '@dou-ui/icons'
import { computed, inject, useAttrs } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { checkboxGroupKey } from './checkbox'
import type { CheckboxProps, CheckboxSlots } from './checkbox'

defineOptions({ name: 'DouCheckbox', inheritAttrs: false })

const props = withDefaults(defineProps<CheckboxProps>(), {
  indeterminate: false,
  disabled: false,
})
const model = defineModel<boolean>({ default: false })
const slots = defineSlots<CheckboxSlots>()

const ns = useNamespace('checkbox')
const group = inject(checkboxGroupKey, undefined)
// Inside a group, the group speaks to the form item for every box.
const formItem = group ? undefined : useFormItem().formItem
const ownSize = useFormSize(() => props.size)

const inGroup = computed(() => !!group && props.value !== undefined)
const checked = computed(() =>
  inGroup.value ? group!.model.value.includes(props.value!) : model.value,
)
const disabled = useFormDisabled(() => props.disabled || group?.disabled.value)
const size = computed(() => props.size ?? group?.size.value ?? ownSize.value)
const name = computed(() => props.name ?? group?.name.value)

function onChange(event: Event) {
  const next = (event.target as HTMLInputElement).checked
  if (inGroup.value) group!.toggle(props.value!, next)
  else model.value = next
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
  ns.is('checked', checked.value && !props.indeterminate),
  ns.is('indeterminate', props.indeterminate),
  ns.is('disabled', disabled.value),
])
</script>

<template>
  <label :class="[classes, attrs.class]" :style="attrs.style as StyleValue">
    <span :class="ns.e('control')">
      <input
        :id="formItem?.inputId"
        type="checkbox"
        :class="ns.e('native')"
        :checked="checked"
        :indeterminate="indeterminate"
        :disabled="disabled"
        :name="name"
        :value="value"
        :aria-label="ariaLabel"
        :aria-describedby="formItem?.describedBy.value"
        :aria-invalid="formItem?.invalid.value || undefined"
        :aria-required="formItem?.required.value || undefined"
        @change="onChange"
        v-bind="nativeAttrs"
      />
      <span :class="ns.e('indicator')" aria-hidden="true">
        <MinusIcon v-if="indeterminate" :stroke-width="2" />
        <CheckIcon v-else :stroke-width="2" />
      </span>
    </span>
    <span v-if="slots.default" :class="ns.e('label')"><slot /></span>
  </label>
</template>
