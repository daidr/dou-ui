<script setup lang="ts">
import { ChevronDownIcon, CloseIcon } from '@dou-ui/icons'
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import DouColorPanel from '../color-panel/color-panel.vue'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { formatColor, parseColor, toCss } from './color'
import type { ColorFormat } from './color'
import type { ColorPickerExpose, ColorPickerProps } from './color-picker'

defineOptions({ name: 'DouColorPicker', inheritAttrs: false })

const props = withDefaults(defineProps<ColorPickerProps>(), {
  format: 'hex',
  panel: 'square',
  gamut: 'srgb',
  showAlpha: false,
  presets: () => [],
  showText: true,
  disabled: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: 'body',
})
const model = defineModel<string | null>()
const emit = defineEmits<{ change: [value: string | null] }>()

const ns = useNamespace('color-picker')
const { t } = useLocale()
const { formItem } = useFormItem()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)
const panelId = `dou-color-picker-${useId()}-panel`

/* the field */

const parsed = computed(() => (model.value ? parseColor(model.value) : null))
const printed = computed(() =>
  parsed.value
    ? formatColor(parsed.value, props.format, { alpha: props.showAlpha, gamut: props.gamut })
    : '',
)
const swatch = computed(() =>
  parsed.value ? toCss(parsed.value, props.gamut, props.showAlpha) : undefined,
)
// Hold the field at the longest value of the format, so it does not
// change width while dragging.
const FIELD_CHARS: Record<ColorFormat, number> = {
  hex: 9,
  rgb: 16,
  hsl: 20,
  hsv: 20,
  hwb: 20,
  lab: 24,
  lch: 23,
  oklab: 29,
  oklch: 26,
}
const valueWidth = computed(() =>
  props.showText && model.value && props.format !== 'hex'
    ? { minWidth: `${FIELD_CHARS[props.format] + (props.showAlpha ? 8 : 0)}ch` }
    : undefined,
)
/* the popup */

const open = ref(false)
const popup = usePopup({
  open,
  trigger: 'manual',
  closeOnOutside: true,
  disabled,
  placement: () => props.placement,
  offset: 4,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle } = popup

let openedWith: string | null | undefined
watch(open, (value) => {
  if (value) openedWith = model.value ?? null
  else if ((model.value ?? null) !== openedWith) {
    emit('change', model.value ?? null)
    formItem?.trigger('change')
  }
})

const fieldRef = useTemplateRef<HTMLElement>('field')
const panelApi = useTemplateRef<InstanceType<typeof DouColorPanel>>('panelApi')
function focus() {
  fieldRef.value?.focus()
}
function toggle() {
  if (disabled.value) return
  open.value = !open.value
}

function onFieldKeydown(event: KeyboardEvent) {
  if (disabled.value) return
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
    event.preventDefault()
    open.value = true
    requestAnimationFrame(() => panelApi.value?.focus())
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // An open format menu takes Escape for itself.
  if ((event.target as HTMLElement).closest('[aria-expanded="true"]')) return
  event.preventDefault()
  open.value = false
  focus()
}

function clear() {
  model.value = null
  emit('change', null)
  formItem?.trigger('change')
  open.value = false
  focus()
}

const showClear = computed(() => props.clearable && !disabled.value && !!model.value)

defineExpose<ColorPickerExpose>({ focus, blur: () => fieldRef.value?.blur() })
</script>

<template>
  <OnlyChild ref="triggerRef">
    <div
      ref="field"
      v-bind="$attrs"
      :id="formItem?.inputId"
      role="button"
      :tabindex="disabled ? -1 : 0"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="rendered ? panelId : undefined"
      :aria-labelledby="formItem ? `${formItem.labelId} ${panelId}-value` : undefined"
      :aria-describedby="formItem?.describedBy.value"
      :aria-invalid="invalid || undefined"
      :aria-disabled="disabled || undefined"
      :class="[
        ns.b(),
        'dou-picker',
        `dou-picker--${size}`,
        ns.is('text', showText),
        ns.is('hex', format === 'hex'),
        ns.is('open', open),
        ns.is('disabled', disabled),
        ns.is('invalid', invalid),
      ]"
      @click="toggle"
      @keydown="onFieldKeydown"
    >
      <span :class="[ns.e('swatch'), ns.is('empty', !model)]">
        <span :style="{ backgroundColor: swatch }" />
      </span>
      <span
        :id="`${panelId}-value`"
        :class="showText ? (model ? 'dou-picker__value' : 'dou-picker__placeholder') : ns.e('sr')"
        :style="valueWidth"
      >
        {{ model ? printed : (placeholder ?? t('colorPicker.placeholder')) }}
      </span>
      <button
        v-if="showClear"
        type="button"
        tabindex="-1"
        class="dou-picker__clear"
        :aria-label="t('colorPicker.clear')"
        @click.stop="clear"
      >
        <CloseIcon />
      </button>
      <ChevronDownIcon v-if="showText" class="dou-picker__arrow" />
    </div>
  </OnlyChild>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        :id="panelId"
        ref="panelRef"
        role="dialog"
        :aria-label="t('colorPicker.placeholder')"
        :class="[ns.e('panel'), 'dou-picker-panel', 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        @keydown="onPanelKeydown"
      >
        <DouColorPanel
          ref="panelApi"
          v-model="model"
          :format="format"
          :panel="panel"
          :gamut="gamut"
          :show-alpha="showAlpha"
          :presets="presets"
          :bordered="false"
        />
      </div>
    </Transition>
  </Teleport>
</template>
