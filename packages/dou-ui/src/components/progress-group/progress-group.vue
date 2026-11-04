<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { Tone } from '../../utils/types'
import { DouTooltip } from '../tooltip'
import type { ProgressGroupItem, ProgressGroupProps, ProgressGroupSlots } from './progress-group'

defineOptions({ name: 'DouProgressGroup' })

const props = withDefaults(defineProps<ProgressGroupProps>(), {
  items: () => [],
  size: 'md',
  legend: false,
  legendDirection: 'horizontal',
  tooltip: true,
})
defineSlots<ProgressGroupSlots>()

const ns = useNamespace('progress-group')

const TONES: Tone[] = ['primary', 'success', 'warning', 'danger', 'neutral']

const total = computed(() => props.items.reduce((sum, item) => sum + Math.max(item.value, 0), 0))
const max = computed(() => props.max ?? total.value)

const round = (value: number) => Math.round(value * 10) / 10

const parts = computed(() => {
  let auto = 0
  return props.items.map((item: ProgressGroupItem, index) => {
    const value = Math.max(item.value, 0)
    const percent = max.value > 0 ? Math.min((value / max.value) * 100, 100) : 0
    const tone = item.color ? undefined : (item.tone ?? TONES[auto++ % TONES.length])
    const text = props.format ? props.format(value, percent) : `${round(percent)}%`
    return { item, index, value, percent, tone, text }
  })
})

const colorStyle = (part: { item: ProgressGroupItem; tone?: Tone }) => ({
  '--dou-progress-group-color':
    part.item.color ??
    // the neutral fill is the text color, too loud for a part; a gray reads as "the rest"
    (part.tone === 'neutral'
      ? 'var(--dou-progress-group-neutral)'
      : `var(--dou-color-${part.tone})`),
})
// A name cut short by the ellipsis shows in full on hover, measured only when
// the pointer arrives, the way Tag does it.
function onLabelEnter(event: PointerEvent) {
  const el = event.currentTarget as HTMLElement
  if (el.scrollWidth > el.clientWidth) el.title = el.textContent?.trim() ?? ''
  else el.removeAttribute('title')
}
const name = (item: ProgressGroupItem, text: string) =>
  item.label ? `${item.label} ${text}` : text
</script>

<template>
  <div :class="[ns.b(), ns.m(size)]" role="group" :aria-label="label">
    <div :class="ns.e('track')">
      <template v-for="part in parts" :key="part.index">
        <DouTooltip
          v-if="part.percent > 0"
          :content="name(part.item, part.text)"
          :disabled="!tooltip"
          follow-cursor
        >
          <span
            :class="ns.e('segment')"
            :style="[{ width: `${part.percent}%` }, colorStyle(part)]"
            role="meter"
            :aria-label="part.item.label"
            :aria-valuenow="part.value"
            aria-valuemin="0"
            :aria-valuemax="max"
            :aria-valuetext="part.text"
          />
        </DouTooltip>
      </template>
    </div>
    <ul v-if="legend" :class="[ns.e('legend'), `${ns.e('legend')}--${legendDirection}`]">
      <li v-for="part in parts" :key="part.index" :class="ns.e('legend-item')">
        <span :class="ns.e('dot')" :style="colorStyle(part)" aria-hidden="true" />
        <span :class="ns.e('legend-text')">
          <slot name="legend" :item="part.item" :percent="part.percent" :text="part.text">
            <span v-if="part.item.label" :class="ns.e('label')" @pointerenter="onLabelEnter">{{
              part.item.label
            }}</span>
            <span :class="ns.e('value')">{{ part.text }}</span>
          </slot>
        </span>
      </li>
    </ul>
  </div>
</template>
