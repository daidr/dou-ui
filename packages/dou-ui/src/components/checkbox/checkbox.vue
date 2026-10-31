<script setup lang="ts" generic="T extends CheckboxModelValue = boolean">
import { CheckIcon, MinusIcon } from '@dou-ui/icons'
import { computed, inject, ref, useAttrs, watch } from 'vue'
import type { Ref, StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from '../form/use-form-item'
import { checkboxGroupKey } from './checkbox'
import type { CheckboxEmits, CheckboxModelValue, CheckboxProps, CheckboxSlots } from './checkbox'

defineOptions({ name: 'DouCheckbox', inheritAttrs: false })

const props = withDefaults(defineProps<CheckboxProps<T>>(), {
  indeterminate: false,
  disabled: false,
})
// Declared by hand rather than with `defineModel`, so the update carries
// `T` and not `T | undefined`.
const emit = defineEmits<CheckboxEmits<T>>()
// also works without `v-model`
const model = ref(props.modelValue) as Ref<T | undefined>
watch(
  () => props.modelValue,
  (next) => (model.value = next),
)
const onValue = computed(() => (props.checkedValue ?? true) as T)
const offValue = computed(() => (props.uncheckedValue ?? false) as T)
const slots = defineSlots<CheckboxSlots>()

const ns = useNamespace('checkbox')
const group = inject(checkboxGroupKey, undefined)
// Inside a group, the group speaks to the form item for every box.
const formItem = group ? undefined : useFormItem().formItem
const ownSize = useFormSize(() => props.size)

const inGroup = computed(() => !!group && props.value !== undefined)
const checked = computed(() =>
  inGroup.value ? group!.model.value.includes(props.value!) : model.value === onValue.value,
)
const disabled = useFormDisabled(() => props.disabled || group?.disabled.value)
const readonly = useFormReadonly(() => props.readonly || group?.readonly.value)
const invalid = computed(() => props.invalid || !!group?.invalid.value || !!formItem?.invalid.value)

// A read-only box takes focus but cancels the click that would toggle it.
function onClick(event: MouseEvent) {
  if (readonly.value) event.preventDefault()
}
const size = computed(() => props.size ?? group?.size.value ?? ownSize.value)
const name = computed(() => props.name ?? group?.name.value)

function onChange(event: Event) {
  const next = (event.target as HTMLInputElement).checked
  if (inGroup.value) group!.toggle(props.value!, next)
  else {
    model.value = next ? onValue.value : offValue.value
    emit('update:modelValue', model.value)
  }
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
  ns.is('readonly', readonly.value),
  ns.is('invalid', invalid.value),
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
        :aria-invalid="invalid || undefined"
        :aria-readonly="readonly || undefined"
        :aria-required="formItem?.required.value || undefined"
        @click="onClick"
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
