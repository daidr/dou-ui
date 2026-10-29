<script setup lang="ts">
import { computed, provide } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import DouCheckTag from './check-tag.vue'
import { checkTagGroupKey } from './check-tag'
import type {
  CheckTagGroupEmits,
  CheckTagGroupProps,
  CheckTagGroupSlots,
  CheckTagOption,
  CheckTagValue,
} from './check-tag'

defineOptions({ name: 'DouCheckTagGroup' })

const props = withDefaults(defineProps<CheckTagGroupProps>(), {
  modelValue: undefined,
  multiple: false,
  clearable: false,
  round: false,
  disabled: false,
})
const emit = defineEmits<CheckTagGroupEmits>()
defineSlots<CheckTagGroupSlots>()

const ns = useNamespace('check-tag-group')
const { formItem } = useFormItem()
formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)

const selected = computed<CheckTagValue[]>(() => {
  const value = props.modelValue
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
})

function set(value: CheckTagValue | CheckTagValue[] | null) {
  emit('update:modelValue', value)
  emit('change', value)
  formItem?.trigger('change')
}

function toggle(value: CheckTagValue) {
  const on = selected.value.includes(value)
  if (props.multiple) {
    set(on ? selected.value.filter((item) => item !== value) : [...selected.value, value])
  } else if (!on) set(value)
  else if (props.clearable) set(null)
}

provide(checkTagGroupKey, {
  isChecked: (value) => selected.value.includes(value),
  toggle,
  tone: computed(() => props.tone),
  size,
  round: computed(() => props.round),
  disabled,
})

const items = computed<CheckTagOption[]>(() =>
  (props.options ?? []).map((option) =>
    typeof option === 'object' ? option : { value: option, label: String(option) },
  ),
)
</script>

<template>
  <div
    :id="formItem?.inputId"
    :class="ns.b()"
    role="group"
    :aria-labelledby="formItem?.labelId"
    :aria-describedby="formItem?.describedBy.value"
    :aria-invalid="formItem?.invalid.value || undefined"
  >
    <slot>
      <DouCheckTag
        v-for="option in items"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        <slot name="label" :option="option" :checked="selected.includes(option.value)">
          {{ option.label ?? option.value }}
        </slot>
      </DouCheckTag>
    </slot>
  </div>
</template>
