<script setup lang="ts">
import { useTemplateRef } from 'vue'
import SegmentField from '../input-date/segment-field.vue'
import type { TimeRange, TimeValue } from '../time-picker/time-picker'
import type { InputTimeExpose, InputTimeProps } from './input-time'

defineOptions({ name: 'DouInputTime' })

withDefaults(defineProps<InputTimeProps>(), {
  format: 'HH:mm',
  range: false,
  hourStep: 1,
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
const model = defineModel<TimeValue | TimeRange | null>()
const emit = defineEmits<{ change: [value: TimeValue | TimeRange | null] }>()

const field = useTemplateRef<InputTimeExpose>('field')
defineExpose<InputTimeExpose>({
  focus: () => field.value?.focus(),
  blur: () => field.value?.blur(),
})
</script>

<template>
  <SegmentField
    ref="field"
    v-model="model"
    kind="time"
    :seconds="format === 'HH:mm:ss'"
    :display-format="displayFormat"
    :range="range"
    :steps="[hourStep, minuteStep, secondStep]"
    :picker="picker"
    :size="size"
    :disabled="disabled"
    :readonly="readonly"
    :invalid="invalid"
    :clearable="clearable"
    :placement="placement"
    :teleport="teleport"
    @change="emit('change', $event as TimeValue | TimeRange | null)"
  />
</template>
