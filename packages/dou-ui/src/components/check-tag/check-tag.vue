<script setup lang="ts">
import { computed, inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormSize } from '../form/use-form-item'
import { checkTagGroupKey } from './check-tag'
import type { CheckTagEmits, CheckTagProps, CheckTagSlots } from './check-tag'

defineOptions({ name: 'DouCheckTag' })

const props = withDefaults(defineProps<CheckTagProps>(), {
  checked: undefined,
  disabled: false,
  round: undefined,
})
const emit = defineEmits<CheckTagEmits>()
const slots = defineSlots<CheckTagSlots>()

const ns = useNamespace('check-tag')
const group = inject(checkTagGroupKey, undefined)
const ownSize = useFormSize(() => props.size)
const ownDisabled = useFormDisabled(() => props.disabled)

const inGroup = computed(() => !!group && props.value !== undefined)
const checked = computed(() =>
  inGroup.value ? group!.isChecked(props.value!) : (props.checked ?? false),
)
const size = computed(() => props.size ?? (group ? group.size.value : ownSize.value))
const disabled = computed(() => ownDisabled.value || !!group?.disabled.value)
const tone = computed(() => props.tone ?? group?.tone.value ?? 'neutral')
const round = computed(() => props.round ?? group?.round.value ?? false)

function toggle() {
  if (disabled.value) return
  if (inGroup.value) return group!.toggle(props.value!)
  emit('update:checked', !checked.value)
  emit('change', !checked.value)
}

const classes = computed(() => [
  ns.b(),
  ns.m(tone.value),
  ns.m(size.value),
  ns.is('checked', checked.value),
  ns.is('round', round.value),
  ns.is('disabled', disabled.value),
])
</script>

<template>
  <button
    type="button"
    :class="classes"
    :aria-pressed="checked"
    :disabled="disabled"
    @click="toggle"
  >
    <span v-if="slots.leading" :class="ns.e('icon')"><slot name="leading" /></span>
    <span :class="ns.e('label')"><slot /></span>
  </button>
</template>
