<script setup lang="ts" generic="T extends SwitchValue = boolean">
import { computed, ref, useAttrs, useId, watch } from 'vue'
import type { Ref, StyleValue } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormDisabled, useFormItem, useFormReadonly, useFormSize } from '../form/use-form-item'
import type { SwitchEmits, SwitchProps, SwitchSlots, SwitchValue } from './switch'

defineOptions({ name: 'DouSwitch', inheritAttrs: false })

const props = withDefaults(defineProps<SwitchProps<T>>(), {
  disabled: false,
  loading: false,
})
// Declared by hand rather than with `defineModel`, so the update carries
// `T` and not `T | undefined`.
const emit = defineEmits<SwitchEmits<T>>()
// also works without `v-model`
const value = ref(props.modelValue) as Ref<T | undefined>
watch(
  () => props.modelValue,
  (next) => (value.value = next),
)
const onValue = computed(() => (props.checkedValue ?? true) as T)
const offValue = computed(() => (props.uncheckedValue ?? false) as T)
const slots = defineSlots<SwitchSlots>()

const ns = useNamespace('switch')
const labelId = useId()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const readonly = useFormReadonly(() => props.readonly)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)
const checked = computed(() => value.value === onValue.value)

// waiting on `beforeChange`
const pending = ref(false)
const busy = computed(() => props.loading || pending.value)

async function toggle() {
  if (disabled.value || readonly.value || busy.value) return
  const next = checked.value ? offValue.value : onValue.value
  if (props.beforeChange) {
    let allowed: boolean | void
    try {
      const result = props.beforeChange(next)
      if (result instanceof Promise) pending.value = true
      allowed = await result
    } catch {
      allowed = false
    } finally {
      pending.value = false
    }
    if (allowed === false) return
  }
  value.value = next
  emit('update:modelValue', next)
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
  ns.is('checked', checked.value),
  ns.is('disabled', disabled.value),
  ns.is('readonly', readonly.value),
  ns.is('invalid', invalid.value),
  ns.is('loading', busy.value),
])
</script>

<template>
  <span :class="[classes, attrs.class]" :style="attrs.style as StyleValue">
    <button
      type="button"
      role="switch"
      :id="formItem?.inputId"
      :class="ns.e('track')"
      :aria-checked="checked"
      :aria-busy="busy || undefined"
      :aria-readonly="readonly || undefined"
      :aria-labelledby="slots.default ? labelId : undefined"
      :aria-label="slots.default ? undefined : ariaLabel"
      :aria-describedby="formItem?.describedBy.value"
      :aria-invalid="invalid || undefined"
      :disabled="disabled"
      @click="toggle"
      v-bind="nativeAttrs"
    >
      <span :class="ns.e('thumb')">
        <span v-if="busy" :class="ns.e('spinner')" aria-hidden="true" />
      </span>
    </button>
    <span v-if="slots.default" :id="labelId" :class="ns.e('label')" @click="toggle">
      <slot />
    </span>
  </span>
</template>
