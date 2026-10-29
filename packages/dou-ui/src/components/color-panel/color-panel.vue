<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { DouFieldGroup } from '../field-group'
import { useFormDisabled, useFormItem } from '../form/use-form-item'
import DouInput from '../input/input.vue'
import DouSelect from '../select/select.vue'
import { ALPHA, CHANNELS, formatLabel } from '../color-picker/channels'
import type { Channel } from '../color-picker/channels'
import {
  COLOR_FORMATS,
  clamp,
  coordsIn,
  formatColor,
  hueIndex,
  hueOf,
  isAchromatic,
  parseColor,
  toCss,
} from '../color-picker/color'
import type { Color, ColorFormat, ColorSpace, Coords } from '../color-picker/color'
import type { ColorPanelExpose, ColorPanelMode, ColorPanelProps } from './color-panel'

defineOptions({ name: 'DouColorPanel' })

const props = withDefaults(defineProps<ColorPanelProps>(), {
  format: 'hex',
  panel: 'square',
  gamut: 'srgb',
  showAlpha: false,
  presets: () => [],
  showInput: true,
  bordered: true,
  disabled: false,
})
const model = defineModel<string | null>()
const emit = defineEmits<{ change: [value: string | null] }>()

const ns = useNamespace('color-panel')
const { t } = useLocale()
const { formItem } = useFormItem()
const disabled = useFormDisabled(() => props.disabled)
const rootRef = useTemplateRef<HTMLElement>('root')

/* the panels */

const panels = computed<ColorPanelMode[]>(() => {
  const list = Array.isArray(props.panel) ? props.panel : [props.panel]
  return list.length ? [...new Set(list)] : ['square']
})
const active = ref<ColorPanelMode>(panels.value[0]!)
watch(panels, (list) => {
  if (!list.includes(active.value)) active.value = list[0]!
})
/** The space the active panel edits in: the square and the wheel are HSV. */
const space = computed<ColorSpace>(() =>
  active.value === 'square' || active.value === 'wheel' ? 'hsv' : active.value,
)
const panelLabel = (panel: ColorPanelMode) =>
  panel === 'square'
    ? t('colorPicker.panelSquare')
    : panel === 'wheel'
      ? t('colorPicker.panelWheel')
      : formatLabel(panel)

/* the color */

const options = computed(() => ({ alpha: props.showAlpha, gamut: props.gamut }))
const print = (value: Color, format: ColorFormat = props.format) =>
  formatColor(value, format, options.value)

// The panel keeps the color in the space it edits in, so a channel the
// value cannot show (the hue of a gray, the chroma the gamut mapping
// cuts) stays where the user put it.
const fallback = (): Color => ({ space: 'hsv', coords: [0, 0, 0], alpha: 1 })
const color = ref<Color>(fallback())

/** Bring a color into the panel's space, keeping the current hue for a gray. */
function adopt(next: Color, hue = hueOf(color.value)): Color {
  const target = space.value
  if (next.space === target) return { ...next, coords: [...next.coords] }
  const coords = coordsIn(next, target, props.gamut)
  const index = hueIndex(target)
  const result: Color = { space: target, coords: [...coords], alpha: next.alpha }
  if (index !== undefined && hue !== undefined && isAchromatic(result)) result.coords[index] = hue
  return result
}

color.value = adopt(parseColor(model.value ?? '') ?? fallback())
watch(model, (value) => {
  const parsed = value ? parseColor(value) : null
  if (!parsed || print(parsed) === print(color.value)) return
  color.value = adopt(parsed)
})
watch(space, () => (color.value = adopt(color.value)))

function set(next: Color) {
  color.value = props.showAlpha ? next : { ...next, alpha: 1 }
  model.value = print(color.value)
}
function setCoord(index: number, value: number) {
  const coords: Coords = [...color.value.coords]
  coords[index] = value
  set({ ...color.value, coords })
}
const setAlpha = (alpha: number) => set({ ...color.value, alpha: clamp(alpha) })

const opaque = computed(() => toCss({ ...color.value, alpha: 1 }, props.gamut))
const current = computed(() => toCss(color.value, props.gamut, props.showAlpha))

/** The color settled: tell the listeners and the form. */
function settle() {
  emit('change', print(color.value))
  formItem?.trigger('change')
}

/* dragging */

/** Follow the pointer, passing its position within the target as 0–1 (unclamped). */
function drag(event: PointerEvent, apply: (x: number, y: number) => void) {
  if (event.button !== 0) return
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const at = (e: PointerEvent) =>
    apply((e.clientX - rect.left) / (rect.width || 1), (e.clientY - rect.top) / (rect.height || 1))
  at(event)
  target.focus()
  target.setPointerCapture?.(event.pointerId)
  const move = (e: PointerEvent) => at(e)
  const up = () => {
    settle()
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

const hsv = computed(() => color.value.coords)
const onAreaDown = (event: PointerEvent) =>
  drag(event, (x, y) => set({ ...color.value, coords: [hsv.value[0], clamp(x), clamp(1 - y)] }))
const onWheelDown = (event: PointerEvent) =>
  drag(event, (x, y) => {
    const [dx, dy] = [x - 0.5, y - 0.5]
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
    set({ ...color.value, coords: [h, clamp(Math.hypot(dx, dy) * 2), hsv.value[2]] })
  })
const onChannelDown = (event: PointerEvent, index: number, channel: Channel) =>
  drag(event, (x) => setCoord(index, channel.min + clamp(x) * (channel.max - channel.min)))
const onAlphaDown = (event: PointerEvent) => drag(event, (x) => setAlpha(clamp(x)))

/** The direction an arrow key moves a value, and how far: 1%, or 10% with Shift. */
function arrow(event: KeyboardEvent) {
  const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  const dy = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
  if (dx || dy) event.preventDefault()
  return { dx, dy, step: (event.shiftKey ? 10 : 1) / 100 }
}

function onAreaKeydown(event: KeyboardEvent) {
  const { dx, dy, step } = arrow(event)
  if (!dx && !dy) return
  const [h, s, v] = hsv.value
  set({ ...color.value, coords: [h, clamp(s + dx * step), clamp(v + dy * step)] })
  settle()
}
function onWheelKeydown(event: KeyboardEvent) {
  const { dx, dy, step } = arrow(event)
  if (!dx && !dy) return
  const [h, s, v] = hsv.value
  set({ ...color.value, coords: [(h + dx * step * 360 + 360) % 360, clamp(s + dy * step), v] })
  settle()
}
function onChannelKeydown(event: KeyboardEvent, index: number, channel: Channel) {
  const { dx, dy, step } = arrow(event)
  if (!dx && !dy) return
  const next = color.value.coords[index]! + (dx || dy) * step * (channel.max - channel.min)
  setCoord(index, clamp(next, channel.min, channel.max))
  settle()
}
function onAlphaKeydown(event: KeyboardEvent) {
  const { dx, dy, step } = arrow(event)
  if (!dx && !dy) return
  setAlpha(color.value.alpha + (dx || dy) * step)
  settle()
}

/* what the panels draw */

const percent = (value: number) => Math.round(value * 100)
const position = (value: number, channel: Channel) =>
  `${((value - channel.min) / (channel.max - channel.min)) * 100}%`
const pure = computed(() => toCss({ space: 'hsv', coords: [hsv.value[0], 1, 1], alpha: 1 }))
const bright = computed(() =>
  toCss({ space: 'hsv', coords: [hsv.value[0], hsv.value[1], 1], alpha: 1 }),
)
const wheelThumb = computed(() => {
  const [h, s] = hsv.value
  const rad = (h * Math.PI) / 180
  return { left: `${50 + 50 * s * Math.cos(rad)}%`, top: `${50 + 50 * s * Math.sin(rad)}%` }
})

const channels = computed(() => CHANNELS[space.value])
/** Each channel's track: the color as that channel runs its range, the others held. */
const tracks = computed(() =>
  channels.value.map((channel, index) => {
    const isHue = channel.name === 'hue'
    const steps = space.value === 'rgb' ? 1 : isHue ? 12 : 16
    const stops = Array.from({ length: steps + 1 }, (_, k) => {
      const coords: Coords = [...color.value.coords]
      coords[index] = channel.min + ((channel.max - channel.min) * k) / steps
      return toCss({ space: space.value, coords, alpha: 1 }, props.gamut)
    })
    return `linear-gradient(to right, ${stops.join(', ')})`
  }),
)

const display = (value: number, channel: Channel) =>
  String(Number((value * channel.scale).toFixed(channel.digits)) || 0)
const valueText = (value: number, channel: Channel) =>
  `${display(value, channel)}${channel.unit ?? ''}`

function onChannelInput(event: Event, index: number, channel: Channel) {
  const input = event.target as HTMLInputElement
  const next = parseFloat(input.value)
  if (Number.isFinite(next)) {
    const coord = clamp(next / channel.scale, channel.min, channel.max)
    if (index < 0) setAlpha(coord)
    else setCoord(index, coord)
    settle()
  }
  input.value = display(index < 0 ? color.value.alpha : color.value.coords[index]!, channel)
}

/* the text box */

// The text box can show the color in any format; it starts at `format`.
const textFormat = ref<ColorFormat>(props.format)
const formatOptions = COLOR_FORMATS.map((format) => ({ value: format, label: formatLabel(format) }))
watch(
  () => props.format,
  (format) => (textFormat.value = format),
)
/** The format's arguments only: the menu in front of the box names the format. */
const shown = computed(() => {
  const full = print(color.value, textFormat.value)
  return textFormat.value === 'hex' ? full : full.slice(full.indexOf('(') + 1, -1)
})
const text = ref('')
watch(shown, (value) => (text.value = value), { immediate: true })
function onTextCommit() {
  const typed = text.value.trim()
  const parsed =
    parseColor(typed) ??
    (textFormat.value === 'hex' ? null : parseColor(`${textFormat.value}(${typed})`))
  if (!parsed) {
    text.value = shown.value
    return
  }
  const before = print(color.value)
  set(adopt(parsed, hueOf(parsed) ?? hueOf(color.value)))
  if (print(color.value) !== before) settle()
}

function pickPreset(preset: string) {
  const parsed = parseColor(preset)
  if (!parsed) return
  set(adopt(parsed))
  settle()
}
const presetValue = (preset: string) => {
  const parsed = parseColor(preset)
  return parsed ? print(parsed) : preset
}
const presetCss = (preset: string) => {
  const parsed = parseColor(preset)
  return parsed ? toCss(parsed, props.gamut, true) : undefined
}

const printed = computed(() => {
  const parsed = model.value ? parseColor(model.value) : null
  return parsed ? print(parsed) : ''
})

function focus() {
  rootRef.value?.querySelector<HTMLElement>('[role="slider"]')?.focus()
}

defineExpose<ColorPanelExpose>({ focus })
</script>

<template>
  <div
    ref="root"
    :class="[ns.b(), ns.is('bordered', bordered), ns.is('disabled', disabled)]"
    :inert="disabled || undefined"
    :aria-disabled="disabled || undefined"
  >
    <div
      v-if="panels.length > 1"
      :class="ns.e('tabs')"
      role="group"
      :aria-label="t('colorPicker.panels')"
    >
      <button
        v-for="item in panels"
        :key="item"
        type="button"
        :class="[ns.e('tab'), ns.is('active', item === active)]"
        :aria-pressed="item === active"
        @click="active = item"
      >
        {{ panelLabel(item) }}
      </button>
    </div>

    <template v-if="active === 'square'">
      <div
        role="slider"
        tabindex="0"
        :class="ns.e('area')"
        :style="{ backgroundColor: pure }"
        :aria-label="t('colorPicker.area')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="percent(hsv[1])"
        :aria-valuetext="t('colorPicker.areaValue', { s: percent(hsv[1]), v: percent(hsv[2]) })"
        @pointerdown="onAreaDown"
        @keydown="onAreaKeydown"
      >
        <span
          :class="ns.e('thumb')"
          :style="{
            left: `${hsv[1] * 100}%`,
            top: `${(1 - hsv[2]) * 100}%`,
            backgroundColor: opaque,
          }"
        />
      </div>
    </template>

    <template v-else-if="active === 'wheel'">
      <div
        role="slider"
        tabindex="0"
        :class="ns.e('wheel')"
        :style="{ '--dou-color-panel-dim': 1 - hsv[2] }"
        :aria-label="t('colorPicker.wheel')"
        aria-valuemin="0"
        aria-valuemax="360"
        :aria-valuenow="Math.round(hsv[0])"
        :aria-valuetext="t('colorPicker.wheelValue', { h: Math.round(hsv[0]), s: percent(hsv[1]) })"
        @pointerdown="onWheelDown"
        @keydown="onWheelKeydown"
      >
        <span :class="ns.e('thumb')" :style="{ ...wheelThumb, backgroundColor: opaque }" />
      </div>
    </template>

    <template v-else>
      <span :class="[ns.e('swatch'), ns.e('bar')]" aria-hidden="true">
        <span :style="{ backgroundColor: current }" />
      </span>
      <div :class="ns.e('channels')">
        <div
          v-for="(channel, index) in channels"
          :key="`${space}-${index}`"
          :class="ns.e('channel')"
        >
          <span :class="ns.e('label')" aria-hidden="true">{{ channel.label }}</span>
          <div
            role="slider"
            tabindex="0"
            :class="ns.e('track')"
            :style="{ '--dou-color-panel-track': tracks[index] }"
            :aria-label="t(`colorPicker.${channel.name}`)"
            :aria-valuemin="display(channel.min, channel)"
            :aria-valuemax="display(channel.max, channel)"
            :aria-valuenow="display(color.coords[index]!, channel)"
            :aria-valuetext="valueText(color.coords[index]!, channel)"
            @pointerdown="onChannelDown($event, index, channel)"
            @keydown="onChannelKeydown($event, index, channel)"
          >
            <span
              :class="ns.e('thumb')"
              :style="{
                left: position(color.coords[index]!, channel),
                backgroundColor: opaque,
              }"
            />
          </div>
          <input
            :class="ns.e('number')"
            type="text"
            inputmode="decimal"
            spellcheck="false"
            autocomplete="off"
            tabindex="-1"
            :aria-label="t(`colorPicker.${channel.name}`)"
            :value="display(color.coords[index]!, channel)"
            @change="onChannelInput($event, index, channel)"
            @keydown.enter.prevent="onChannelInput($event, index, channel)"
            @keydown.up.down="onChannelKeydown($event, index, channel)"
          />
        </div>
        <div v-if="showAlpha" :class="ns.e('channel')">
          <span :class="ns.e('label')" aria-hidden="true">{{ ALPHA.label }}</span>
          <div
            role="slider"
            tabindex="0"
            :class="[ns.e('track'), ns.e('alpha')]"
            :style="{ '--dou-color-panel-opaque': opaque }"
            :aria-label="t('colorPicker.alpha')"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="percent(color.alpha)"
            :aria-valuetext="`${percent(color.alpha)}%`"
            @pointerdown="onAlphaDown"
            @keydown="onAlphaKeydown"
          >
            <span
              :class="ns.e('thumb')"
              :style="{ left: `${color.alpha * 100}%`, backgroundColor: current }"
            />
          </div>
          <input
            :class="ns.e('number')"
            type="text"
            inputmode="decimal"
            spellcheck="false"
            autocomplete="off"
            tabindex="-1"
            :aria-label="t('colorPicker.alpha')"
            :value="display(color.alpha, ALPHA)"
            @change="onChannelInput($event, -1, ALPHA)"
            @keydown.enter.prevent="onChannelInput($event, -1, ALPHA)"
            @keydown.up.down="onAlphaKeydown"
          />
        </div>
      </div>
    </template>

    <div v-if="active === 'square' || active === 'wheel'" :class="ns.e('controls')">
      <div :class="ns.e('sliders')">
        <div
          v-if="active === 'square'"
          role="slider"
          tabindex="0"
          :class="[ns.e('track'), ns.e('hue')]"
          :aria-label="t('colorPicker.hue')"
          aria-valuemin="0"
          aria-valuemax="360"
          :aria-valuenow="Math.round(hsv[0])"
          @pointerdown="onChannelDown($event, 0, CHANNELS.hsv[0])"
          @keydown="onChannelKeydown($event, 0, CHANNELS.hsv[0])"
        >
          <span
            :class="ns.e('thumb')"
            :style="{ left: `${(hsv[0] / 360) * 100}%`, backgroundColor: pure }"
          />
        </div>
        <div
          v-else
          role="slider"
          tabindex="0"
          :class="[ns.e('track'), ns.e('value')]"
          :style="{ '--dou-color-panel-bright': bright }"
          :aria-label="t('colorPicker.brightness')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="percent(hsv[2])"
          :aria-valuetext="`${percent(hsv[2])}%`"
          @pointerdown="onChannelDown($event, 2, CHANNELS.hsv[2])"
          @keydown="onChannelKeydown($event, 2, CHANNELS.hsv[2])"
        >
          <span
            :class="ns.e('thumb')"
            :style="{ left: `${hsv[2] * 100}%`, backgroundColor: opaque }"
          />
        </div>
        <div
          v-if="showAlpha"
          role="slider"
          tabindex="0"
          :class="[ns.e('track'), ns.e('alpha')]"
          :style="{ '--dou-color-panel-opaque': opaque }"
          :aria-label="t('colorPicker.alpha')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="percent(color.alpha)"
          :aria-valuetext="`${percent(color.alpha)}%`"
          @pointerdown="onAlphaDown"
          @keydown="onAlphaKeydown"
        >
          <span
            :class="ns.e('thumb')"
            :style="{ left: `${color.alpha * 100}%`, backgroundColor: current }"
          />
        </div>
      </div>
      <span :class="[ns.e('swatch'), ns.e('preview')]" aria-hidden="true">
        <span :style="{ backgroundColor: current }" />
      </span>
    </div>

    <DouFieldGroup v-if="showInput" :class="ns.e('entry')" size="sm" block>
      <DouSelect
        :model-value="textFormat"
        :class="ns.e('format')"
        :options="formatOptions"
        :aria-label="t('colorPicker.format')"
        @update:model-value="textFormat = $event as ColorFormat"
      />
      <DouInput
        v-model="text"
        :class="[ns.e('text'), ns.is('hex', textFormat === 'hex')]"
        spellcheck="false"
        autocomplete="off"
        :aria-label="t('colorPicker.text')"
        @change="onTextCommit"
        @keydown.enter.prevent="onTextCommit"
      />
    </DouFieldGroup>
    <div
      v-if="presets.length"
      :class="ns.e('presets')"
      role="group"
      :aria-label="t('colorPicker.presets')"
    >
      <button
        v-for="preset in presets"
        :key="preset"
        type="button"
        :class="[ns.e('preset'), ns.is('selected', presetValue(preset) === printed)]"
        :aria-label="preset"
        :aria-pressed="presetValue(preset) === printed"
        @click="pickPreset(preset)"
      >
        <span :style="{ backgroundColor: presetCss(preset) }" />
      </button>
    </div>
  </div>
</template>
