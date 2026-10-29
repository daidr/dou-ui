<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import type { DateRange, DateValue } from '../date-picker/date-picker'
import type { InputDateExpose, InputDateProps } from './input-date'
import SegmentField from './segment-field.vue'

defineOptions({ name: 'DouInputDate' })

const props = withDefaults(defineProps<InputDateProps>(), {
  type: 'date',
  timeFormat: 'HH:mm',
  range: false,
  minuteStep: 1,
  secondStep: 1,
  picker: false,
  disabled: false,
  readonly: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: undefined,
})
const model = defineModel<DateValue | DateRange | null>()
const emit = defineEmits<{ change: [value: DateValue | DateRange | null] }>()

// Like the date picker, only days (and days with a time) come in ranges.
const range = computed(() => props.range && (props.type === 'date' || props.type === 'datetime'))

const field = useTemplateRef<InputDateExpose>('field')
defineExpose<InputDateExpose>({
  focus: () => field.value?.focus(),
  blur: () => field.value?.blur(),
})
</script>

<template>
  <SegmentField
    ref="field"
    v-model="model"
    :kind="type"
    :seconds="type === 'datetime' && timeFormat === 'HH:mm:ss'"
    :display-format="displayFormat"
    :range="range"
    :min="min"
    :max="max"
    :disabled-date="disabledDate"
    :steps="[1, minuteStep, secondStep]"
    :picker="picker"
    :week-start="weekStart"
    :size="size"
    :disabled="disabled"
    :readonly="readonly"
    :invalid="invalid"
    :clearable="clearable"
    :placement="placement"
    :teleport="teleport"
    @change="emit('change', $event as DateValue | DateRange | null)"
  />
</template>
