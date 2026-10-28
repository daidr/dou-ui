<script setup lang="ts">
import { computed, inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { checkboxGroupKey } from './checkbox'
import type { CheckboxProps, CheckboxSlots } from './checkbox'

defineOptions({ name: 'DouCheckbox' })

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

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('checked', checked.value && !props.indeterminate),
  ns.is('indeterminate', props.indeterminate),
  ns.is('disabled', disabled.value),
])
</script>

<template>
  <label :class="classes">
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
      />
      <span :class="ns.e('indicator')" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path v-if="indeterminate" d="M4.5 8h7" stroke-linecap="round" />
          <path v-else d="M4 8.5l2.5 2.5L12 5.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </span>
    <span v-if="slots.default" :class="ns.e('label')"><slot /></span>
  </label>
</template>
