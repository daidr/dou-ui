<script setup lang="ts">
import { computed, inject, useAttrs } from 'vue'
import type { StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormSize } from '../form/use-form-item'
import { radioGroupKey } from './radio'
import type { RadioProps, RadioSlots, RadioValue } from './radio'

defineOptions({ name: 'DouRadio', inheritAttrs: false })

const props = withDefaults(defineProps<RadioProps>(), {
  disabled: false,
})
const model = defineModel<RadioValue>()
const slots = defineSlots<RadioSlots>()

const ns = useNamespace('radio')
const group = inject(radioGroupKey, undefined)

const checked = computed(() => (group ? group.model.value : model.value) === props.value)
const ownSize = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled || group?.disabled.value)
const size = computed(() => props.size ?? group?.size.value ?? ownSize.value)
const name = computed(() => group?.name.value ?? props.name)

function onChange() {
  if (group) group.select(props.value)
  else model.value = props.value
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
  ns.is('checked', checked.value),
  ns.is('disabled', disabled.value),
])
</script>

<template>
  <label :class="[classes, attrs.class]" :style="attrs.style as StyleValue">
    <span :class="ns.e('control')">
      <input
        type="radio"
        :class="ns.e('native')"
        :checked="checked"
        :disabled="disabled"
        :name="name"
        :value="typeof value === 'boolean' ? String(value) : value"
        @change="onChange"
        v-bind="nativeAttrs"
      />
      <span :class="ns.e('indicator')" aria-hidden="true" />
    </span>
    <span v-if="slots.default" :class="ns.e('label')"><slot /></span>
  </label>
</template>
