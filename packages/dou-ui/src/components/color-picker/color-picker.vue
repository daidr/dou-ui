<script setup lang="ts">
import { ChevronDownIcon, CloseIcon } from '@dou-ui/icons'
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { clamp, parseHex, toHex } from './color'
import type { Hsva } from './color'
import type { ColorPickerExpose, ColorPickerProps } from './color-picker'

defineOptions({ name: 'DouColorPicker', inheritAttrs: false })

const props = withDefaults(defineProps<ColorPickerProps>(), {
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

// The panel works in HSV so the hue survives while the color is gray.
const fallback: Hsva = { h: 0, s: 0, v: 0, a: 1 }
const hsva = ref<Hsva>(parseHex(model.value ?? '') ?? fallback)
watch(model, (value) => {
  const parsed = value ? parseHex(value) : null
  if (!parsed) return
  if (toHex(parsed, props.showAlpha) === toHex(hsva.value, props.showAlpha)) return
  hsva.value = parsed.s === 0 || parsed.v === 0 ? { ...parsed, h: hsva.value.h } : parsed
})

const hex = computed(() =>
  model.value ? toHex(parseHex(model.value) ?? fallback, props.showAlpha) : '',
)

function update(next: Partial<Hsva>) {
  hsva.value = { ...hsva.value, ...next }
  model.value = toHex(hsva.value, props.showAlpha)
}

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
const areaRef = useTemplateRef<HTMLElement>('area')
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
    requestAnimationFrame(() => areaRef.value?.focus())
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  open.value = false
  focus()
}

/* dragging */

function drag(event: PointerEvent, apply: (x: number, y: number) => void) {
  if (event.button !== 0) return
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const at = (e: PointerEvent) =>
    apply(
      clamp((e.clientX - rect.left) / (rect.width || 1)),
      clamp((e.clientY - rect.top) / (rect.height || 1)),
    )
  at(event)
  target.focus()
  target.setPointerCapture?.(event.pointerId)
  const move = (e: PointerEvent) => at(e)
  const up = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

const onAreaDown = (event: PointerEvent) => drag(event, (x, y) => update({ s: x, v: 1 - y }))
const onHueDown = (event: PointerEvent) => drag(event, (x) => update({ h: x * 360 }))
const onAlphaDown = (event: PointerEvent) => drag(event, (x) => update({ a: x }))

/** Arrow keys step by 1%, or 10% with Shift. */
function nudge(event: KeyboardEvent, axis: 'area' | 'hue' | 'alpha') {
  const big = event.shiftKey ? 10 : 1
  const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  const dy = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
  if (!dx && !dy) return
  event.preventDefault()
  const { h, s, v, a } = hsva.value
  if (axis === 'area') update({ s: clamp(s + (dx * big) / 100), v: clamp(v + (dy * big) / 100) })
  else if (axis === 'hue') update({ h: clamp(h + (dx || dy) * big * 3.6, 0, 360) })
  else update({ a: clamp(a + ((dx || dy) * big) / 100) })
}

/* the text box */

const text = ref('')
watch(hex, (value) => (text.value = value), { immediate: true })
function onTextCommit() {
  const parsed = parseHex(text.value)
  if (parsed) update(props.showAlpha ? parsed : { ...parsed, a: 1 })
  else text.value = hex.value
}

function pickPreset(color: string) {
  const parsed = parseHex(color)
  if (parsed) update(props.showAlpha ? parsed : { ...parsed, a: 1 })
}

function clear() {
  model.value = null
  emit('change', null)
  formItem?.trigger('change')
  open.value = false
  focus()
}

const percent = (value: number) => Math.round(value * 100)
const pure = computed(() => toHex({ h: hsva.value.h, s: 1, v: 1, a: 1 }, false))
const opaque = computed(() => toHex({ ...hsva.value, a: 1 }, false))
const presetHex = (color: string) => {
  const parsed = parseHex(color)
  return parsed ? toHex(parsed, props.showAlpha) : color
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
        ns.is('open', open),
        ns.is('disabled', disabled),
        ns.is('invalid', invalid),
      ]"
      @click="toggle"
      @keydown="onFieldKeydown"
    >
      <span :class="[ns.e('swatch'), ns.is('empty', !model)]">
        <span :style="{ backgroundColor: hex || undefined }" />
      </span>
      <span
        :id="`${panelId}-value`"
        :class="showText ? (model ? 'dou-picker__value' : 'dou-picker__placeholder') : ns.e('sr')"
      >
        {{ model ? hex : (placeholder ?? t('colorPicker.placeholder')) }}
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
    <Transition name="dou-floating">
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
        <div
          ref="area"
          role="slider"
          tabindex="0"
          :class="ns.e('area')"
          :style="{ backgroundColor: pure }"
          :aria-label="t('colorPicker.area')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="percent(hsva.s)"
          :aria-valuetext="t('colorPicker.areaValue', { s: percent(hsva.s), v: percent(hsva.v) })"
          @pointerdown="onAreaDown"
          @keydown="nudge($event, 'area')"
        >
          <span
            :class="ns.e('thumb')"
            :style="{
              left: `${hsva.s * 100}%`,
              top: `${(1 - hsva.v) * 100}%`,
              backgroundColor: opaque,
            }"
          />
        </div>
        <div :class="ns.e('controls')">
          <div :class="ns.e('sliders')">
            <div
              role="slider"
              tabindex="0"
              :class="[ns.e('track'), ns.e('hue')]"
              :aria-label="t('colorPicker.hue')"
              aria-valuemin="0"
              aria-valuemax="360"
              :aria-valuenow="Math.round(hsva.h)"
              @pointerdown="onHueDown"
              @keydown="nudge($event, 'hue')"
            >
              <span
                :class="ns.e('thumb')"
                :style="{ left: `${(hsva.h / 360) * 100}%`, backgroundColor: pure }"
              />
            </div>
            <div
              v-if="showAlpha"
              role="slider"
              tabindex="0"
              :class="[ns.e('track'), ns.e('alpha')]"
              :style="{ '--dou-color-picker-opaque': opaque }"
              :aria-label="t('colorPicker.alpha')"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="percent(hsva.a)"
              :aria-valuetext="`${percent(hsva.a)}%`"
              @pointerdown="onAlphaDown"
              @keydown="nudge($event, 'alpha')"
            >
              <span
                :class="ns.e('thumb')"
                :style="{ left: `${hsva.a * 100}%`, backgroundColor: hex || opaque }"
              />
            </div>
          </div>
          <span :class="[ns.e('swatch'), ns.e('preview')]" aria-hidden="true">
            <span :style="{ backgroundColor: hex || opaque }" />
          </span>
        </div>
        <input
          v-model="text"
          :class="ns.e('text')"
          type="text"
          spellcheck="false"
          autocomplete="off"
          :aria-label="t('colorPicker.hex')"
          @change="onTextCommit"
          @keydown.enter.prevent="onTextCommit"
        />
        <div
          v-if="presets.length"
          :class="ns.e('presets')"
          role="group"
          :aria-label="t('colorPicker.presets')"
        >
          <button
            v-for="color in presets"
            :key="color"
            type="button"
            :class="[ns.e('preset'), ns.is('selected', presetHex(color) === hex)]"
            :aria-label="color"
            :aria-pressed="presetHex(color) === hex"
            @click="pickPreset(color)"
          >
            <span :style="{ backgroundColor: color }" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
