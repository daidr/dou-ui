<script setup lang="ts">
import { computed, inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { SlotNodes, filled } from '../../utils/slot'
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
    <!-- rendered once: a leading slot that renders nothing leaves no icon -->
    <template v-for="leading in [filled(slots.leading)]" :key="0">
      <span v-if="leading" :class="ns.e('icon')"><SlotNodes :nodes="leading" /></span>
    </template>
    <span :class="ns.e('label')"><slot /></span>
  </button>
</template>
